import { cookies } from "next/headers";
import { query, queryOne } from "@/lib/db/client";
import { isOrgKind, type OrgKind } from "@/lib/terms";
import { isValidTimeZone } from "@/lib/tz";

/**
 * The guided set-up ("funnel") that new accounts go through.
 *
 * Organizations: 1 Organization → 2 Services → 3 Account → 4 Email code →
 * 5 Start (trial or 30% off) → 6 Team → 7 Clients.
 * Individuals:   1 About you → 2 Account → 3 Email code → 4 First person.
 *
 * Steps before the account exists live under /get-started (public). Their
 * answers are kept in a short-lived cookie in this browser (nothing is saved
 * in the database until the account is verified), then applied by
 * /setup/.../finish. Steps after that live under /setup and need sign-in;
 * users.setup_step remembers where someone stopped, and the app sends them
 * back there until they finish.
 */

export const DRAFT_COOKIE = "setup_draft";
const DRAFT_MAX_AGE = 60 * 60 * 24 * 3; // three days: long enough to come back to the email code

export const ORG_STEPS = ["Organization", "Services", "Account", "Verify email", "Start", "Team", "Clients"] as const;
export const SOLO_STEPS = ["About you", "Account", "Verify email", "First person"] as const;

/** Team-size choices and the seats each suggests on the Start step. */
export const TEAM_SIZES = [
  { value: "2-5", label: "2–5 people", seats: 5 },
  { value: "6-10", label: "6–10 people", seats: 10 },
  { value: "11-25", label: "11–25 people", seats: 25 },
  { value: "26-50", label: "26–50 people", seats: 50 },
  { value: "50+", label: "More than 50", seats: 50 },
] as const;
export type TeamSize = (typeof TEAM_SIZES)[number]["value"];
export function seatsForTeamSize(size: string | undefined): number {
  return TEAM_SIZES.find((t) => t.value === size)?.seats ?? 5;
}

export const SOLO_USES = [
  { value: "personal", label: "Personal", hint: "Keep track of the people in your life: friends, family, follow-ups." },
  { value: "business", label: "Solo business or freelance", hint: "Your own clients or customers: stylists, coaches, consultants, trades." },
  { value: "other", label: "Something else", hint: "Volunteering, a side project, or anything with people to keep up with." },
] as const;
export type SoloUse = (typeof SOLO_USES)[number]["value"];
export function isSoloUse(v: unknown): v is SoloUse {
  return SOLO_USES.some((u) => u.value === v);
}

/** Service suggestions for the Services step (they can add their own too). */
export const SUGGESTED_SERVICES: Record<OrgKind | "solo", string[]> = {
  nonprofit: ["Case management", "Intake", "Housing help", "Food assistance", "Job readiness", "Benefits help", "Transportation", "Referral"],
  business: ["Consultation", "Appointment", "Follow-up visit", "Class or session", "Repair", "Delivery", "Product sale", "Membership"],
  solo: ["Consultation", "Session", "Follow-up", "Project work", "Class", "Appointment"],
};

export type DraftService = { name: string; price: string | null };

export type OrgDraft = {
  flow: "org";
  name?: string;
  kind?: OrgKind;
  size?: TeamSize;
  timezone?: string;
  services?: DraftService[];
  agreed?: boolean;
  offer?: boolean;
  utm?: Record<string, string>;
  /** Random id for this set-up, so the owner's drop-off view counts each person once per step. */
  fid?: string;
};
export type SoloDraft = { flow: "solo"; use?: SoloUse; services?: DraftService[]; offer?: boolean; utm?: Record<string, string>; fid?: string };
export type Draft = OrgDraft | SoloDraft;

function cleanServices(v: unknown): DraftService[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: DraftService[] = [];
  for (const s of v.slice(0, 30)) {
    const name = typeof s?.name === "string" ? s.name.trim().replace(/\s+/g, " ").slice(0, 80) : "";
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const price = typeof s?.price === "string" && s.price.trim() ? s.price.trim().slice(0, 20) : null;
    out.push({ name, price });
  }
  return out;
}

function cleanFid(v: unknown): string | undefined {
  return typeof v === "string" && /^[0-9a-f-]{36}$/.test(v) ? v : undefined;
}

function cleanUtm(v: unknown): Record<string, string> | undefined {
  if (!v || typeof v !== "object") return undefined;
  const out: Record<string, string> = {};
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content"]) {
    const val = (v as Record<string, unknown>)[k];
    if (typeof val === "string" && val.trim()) out[k] = val.trim().slice(0, 80);
  }
  return Object.keys(out).length ? out : undefined;
}

/** The draft in this browser, checked field by field (it's only ever this person's own answers). */
export async function readDraft(): Promise<Draft | null> {
  return parseDraft((await cookies()).get(DRAFT_COOKIE)?.value);
}

/**
 * At sign-up: copies this browser's answers onto the new account, so opening
 * the confirmation email on another device still finishes the set-up.
 */
export async function saveDraftToAccount(userId: string): Promise<void> {
  const d = await readDraft();
  if (d) await query(`update users set setup_draft = $2 where id = $1`, [userId, JSON.stringify(d)]);
}

/** The answers for the finish step: this browser's, or the copy saved on the account at sign-up. */
export async function draftForAccount(userId: string): Promise<Draft | null> {
  const here = await readDraft();
  if (here) return here;
  const row = await queryOne<{ setup_draft: unknown }>(`select setup_draft from users where id = $1`, [userId]);
  return row?.setup_draft ? parseDraft(JSON.stringify(row.setup_draft)) : null;
}

/** Once applied: removes the answers from the browser and the account. */
export async function clearDraftEverywhere(userId: string): Promise<void> {
  await clearDraft();
  await query(`update users set setup_draft = null where id = $1`, [userId]);
}

function parseDraft(raw: string | undefined): Draft | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Record<string, unknown>;
    if (d.flow === "org") {
      const size = TEAM_SIZES.find((t) => t.value === d.size)?.value;
      return {
        flow: "org",
        name: typeof d.name === "string" ? d.name.trim().slice(0, 200) || undefined : undefined,
        kind: isOrgKind(d.kind) ? d.kind : undefined,
        size,
        timezone: typeof d.timezone === "string" && isValidTimeZone(d.timezone) ? d.timezone : undefined,
        services: cleanServices(d.services),
        agreed: d.agreed === true,
        offer: d.offer === true,
        utm: cleanUtm(d.utm),
        fid: cleanFid(d.fid),
      };
    }
    if (d.flow === "solo") {
      return {
        flow: "solo",
        use: isSoloUse(d.use) ? d.use : undefined,
        services: cleanServices(d.services),
        offer: d.offer === true,
        utm: cleanUtm(d.utm),
        fid: cleanFid(d.fid),
      };
    }
  } catch {
    // A damaged cookie just means starting the questions again.
  }
  return null;
}

/** Saves the draft (server actions and route handlers only). */
export async function writeDraft(d: Draft): Promise<void> {
  (await cookies()).set(DRAFT_COOKIE, JSON.stringify(d), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DRAFT_MAX_AGE,
  });
}

export async function clearDraft(): Promise<void> {
  (await cookies()).delete(DRAFT_COOKIE);
}

/** Sign-up link for the Account step: comes back to the right finish step, keeping the ad tags. */
export function signupHref(flow: "org" | "solo", utm?: Record<string, string>): string {
  const params = new URLSearchParams({ next: `/setup/${flow}/finish`, ...(utm ?? {}) });
  return `/signup?${params}`;
}

/** Which set-up the sign-up / email-code pages are part of, from where they continue to. */
export function setupFlowFor(next: string | undefined): "org" | "solo" | null {
  if (next?.startsWith("/setup/org/")) return "org";
  if (next?.startsWith("/setup/solo/")) return "solo";
  return null;
}

/** Where an unfinished set-up resumes (users.setup_step). */
export const SETUP_PATHS: Record<string, string> = {
  "org:plan": "/setup/org/plan",
  "org:team": "/setup/org/team",
  "org:clients": "/setup/org/clients",
  "solo:first": "/setup/solo/first",
};
