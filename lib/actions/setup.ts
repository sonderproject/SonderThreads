"use server";

import { randomUUID } from "crypto";
import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { query } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { getMembership } from "@/lib/org";
import { isOrgKind } from "@/lib/terms";
import { isValidTimeZone } from "@/lib/tz";
import { logEvent } from "@/lib/events";
import { createInvite } from "@/lib/actions/org";
import { createPersonRecord } from "@/lib/actions/people";
import {
  INDUSTRIES,
  TEAM_SIZES,
  isSoloUse,
  servicesForIndustry,
  readDraft,
  signupHref,
  writeDraft,
  type DraftService,
  type OrgDraft,
  type SoloDraft,
} from "@/lib/setup";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"];

function utmFrom(formData: FormData): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const k of UTM_KEYS) {
    const v = formData.get(k)?.toString().trim();
    if (v) out[k] = v.slice(0, 80);
  }
  return Object.keys(out).length ? out : undefined;
}

/** Checked suggestions ("svc", with "price:<name>") plus up to three typed-in ones ("custom" / "custom_price"). */
function servicesFrom(formData: FormData): DraftService[] {
  const out: DraftService[] = [];
  for (const name of formData.getAll("svc").map(String).slice(0, 20)) {
    out.push({ name, price: formData.get(`price:${name}`)?.toString().trim() || null });
  }
  const customs = formData.getAll("custom").map(String).slice(0, 3);
  const prices = formData.getAll("custom_price").map(String);
  customs.forEach((name, i) => {
    if (name.trim()) out.push({ name: name.trim(), price: prices[i]?.trim() || null });
  });
  return out;
}

// ---- Before the account exists (answers stay in this browser's cookie) ----

/**
 * Organization step 1 (the only question page): name, type, line of work, team size, time zone.
 * The line of work loads starter services; the organization agreement is part of the sign-up
 * consent on the next page. Then on to the account.
 */
export async function saveOrgBasics(formData: FormData): Promise<void> {
  const prev = await readDraft();
  const base: OrgDraft = prev?.flow === "org" ? prev : { flow: "org" };
  const name = (formData.get("name")?.toString() ?? "").trim().slice(0, 200);
  const kind = formData.get("kind");
  const size = TEAM_SIZES.find((t) => t.value === formData.get("size"))?.value;
  const tz = formData.get("timezone")?.toString() ?? "";
  const offer = formData.get("offer") === "skip" || base.offer;
  const okKind = isOrgKind(kind) ? kind : undefined;
  // Each type has its own list ("business:salon", "nonprofit:food"); a pick for the other type is ignored.
  const [industryKind, industryValue] = (formData.get("industry")?.toString() ?? "").split(":");
  const industry =
    okKind && industryKind === okKind && INDUSTRIES[okKind].some((i) => i.value === industryValue) ? industryValue : undefined;
  const next: OrgDraft = {
    ...base,
    name: name || undefined,
    kind: okKind,
    size,
    industry,
    services: okKind ? servicesForIndustry(okKind, industry) : base.services,
    timezone: isValidTimeZone(tz) ? tz : base.timezone,
    offer,
    utm: utmFrom(formData) ?? base.utm,
    fid: base.fid ?? randomUUID(),
  };
  await writeDraft(next);
  if (!next.name) redirect("/get-started/org?error=name");
  if (!next.kind) redirect("/get-started/org?error=kind");
  if (!next.size) redirect("/get-started/org?error=size");
  await funnel(next, "funnel.org.basics", { kind: next.kind, size: next.size, industry: next.industry ?? null });
  redirect(signupHref("org", next.utm));
}

/** Sign-up agreed to the Terms with the organization wording (sign-up form or Google/Apple notice). */
export async function markOrgAgreed(): Promise<void> {
  const d = await readDraft();
  if (d?.flow === "org" && !d.agreed) await writeDraft({ ...d, agreed: true });
}

/** Individual step 1: what they'll use it for, and services if it's a business. */
export async function saveSoloBasics(formData: FormData): Promise<void> {
  const prev = await readDraft();
  const base: SoloDraft = prev?.flow === "solo" ? prev : { flow: "solo" };
  const use = formData.get("use");
  const next: SoloDraft = {
    ...base,
    use: isSoloUse(use) ? use : undefined,
    services: isSoloUse(use) && use === "business" ? servicesFrom(formData) : [],
    offer: formData.get("offer") === "skip" || base.offer,
    utm: utmFrom(formData) ?? base.utm,
    fid: base.fid ?? randomUUID(),
  };
  await writeDraft(next);
  if (!next.use) redirect("/get-started/solo?error=use");
  await funnel(next, "funnel.solo.basics", { use: next.use });
  redirect(signupHref("solo", next.utm));
}

/**
 * One row per step reached, for the owner's sign-up drop-off view. Logged
 * once per browser (draft.seen), so resubmitting a step can't flood app_events.
 */
async function funnel(draft: OrgDraft | SoloDraft, kind: string, meta: Record<string, unknown> = {}): Promise<void> {
  if (draft.seen?.includes(kind)) return;
  await writeDraft({ ...draft, seen: [...(draft.seen ?? []), kind] });
  await logEvent(kind, "Set-up step", { meta: { fid: draft.fid ?? null, ...meta } }).catch(() => undefined);
}

// ---- After the account exists ----

async function setStep(userId: string, step: string | null): Promise<void> {
  await query(`update users set setup_step = $2 where id = $1`, [userId, step]);
}

/** Organization step 6: invite up to five people now (each invite holds a seat), or skip. */
export async function inviteTeamFromSetup(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const m = await getMembership();
  if (!m?.active || m.role !== "admin") redirect("/");
  const emails = formData.getAll("email").map((e) => e.toString().trim()).slice(0, 5);
  const roles = formData.getAll("role").map(String);
  const failed: string[] = [];
  let sent = 0;
  for (const [i, email] of emails.entries()) {
    if (!email) continue;
    const res = await createInvite(email, roles[i] || "case_manager");
    if (res.ok) sent++;
    else failed.push(`${email}: ${res.error}`);
  }
  if (failed.length) {
    redirect(`/setup/org/team?${new URLSearchParams({ sent: String(sent), failed: failed.join("\n").slice(0, 800) })}`);
  }
  await setStep(userId, "org:clients");
  redirect(`/setup/org/clients${sent ? `?invited=${sent}` : ""}`);
}

export async function skipTeamStep(): Promise<void> {
  await setStep(await requireUserId(), "org:clients");
  redirect("/setup/org/clients");
}

/** Organization step 7 (last): upload clients now, or go to the app. Either way set-up is done. */
export async function finishOrgSetup(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  await setStep(userId, null);
  await logEvent("setup.done", "Organization set-up finished", { meta: { user: userId, flow: "org" } }).catch(() => undefined);
  revalidatePath("/", "layout");
  redirect(formData.get("go") === "import" ? "/settings/data#import" : "/team");
}

/** Individual step 4 (last): add a first person, or skip. */
export async function finishSoloSetup(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const name = (formData.get("name")?.toString() ?? "").trim().slice(0, 200);
  const offer = formData.get("offer") === "skip";
  let personId: string | null = null;
  if (name && formData.get("skip") !== "1") {
    try {
      personId = (await createPersonRecord({ fullName: name })).id;
    } catch (err) {
      unstable_rethrow(err);
      console.error("[setup] first person failed", err);
    }
  }
  await setStep(userId, null);
  await logEvent("setup.done", "Individual set-up finished", { meta: { user: userId, flow: "solo", added: Boolean(personId) } }).catch(() => undefined);
  revalidatePath("/", "layout");
  if (offer) redirect("/billing?offer=skip");
  redirect(personId ? `/people/${personId}` : "/");
}
