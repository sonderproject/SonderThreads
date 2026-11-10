"use server";

import { assertCanWrite } from "@/lib/billing";
import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { getMembership } from "@/lib/org";
import { notify } from "@/lib/notify";
import { logActivity } from "./activity";

/** Referrals are an admin tool: the inbox, the log and the link. */
async function requireAdmin(): Promise<{ userId: string; orgId: string }> {
  const userId = await requireUserId();
  const m = await getMembership();
  if (!m?.active || m.role !== "admin") redirect("/");
  return { userId, orgId: m.orgId };
}

const clean = (v: FormDataEntryValue | null, max: number) =>
  (v?.toString() ?? "").replace(/\s+/g, " ").trim().slice(0, max);

function newCode(): string {
  return randomBytes(9).toString("base64url");
}

/* ------------------------------------------------------------------ */
/* Public form                                                         */
/* ------------------------------------------------------------------ */

/** The public referral form (no sign-in). One link per organization. */
export async function submitReferral(formData: FormData): Promise<void> {
  const code = clean(formData.get("code"), 40);
  const back = (q: string) => redirect(`/refer/${encodeURIComponent(code)}?${q}`);

  const org = await queryOne<{ id: string; name: string }>(
    `select id, name from organizations where referral_code = $1 and referral_enabled`,
    [code],
  );
  if (!org) back("error=closed");

  // Spam trap: a hidden field people never see or fill.
  if (clean(formData.get("website"), 200)) back("sent=1");

  const first = clean(formData.get("first_name"), 80);
  const last = clean(formData.get("last_name"), 80);
  const phone = clean(formData.get("phone"), 40).replace(/[^\d+()\-. ]/g, "");
  const dobRaw = clean(formData.get("dob"), 10);
  const referrer = clean(formData.get("referrer_name"), 120);
  const dept = clean(formData.get("referrer_department"), 120);

  if (!first || !last) back("error=name");
  if (phone.replace(/\D/g, "").length < 7) back("error=phone");
  const dob = /^\d{4}-\d{2}-\d{2}$/.test(dobRaw) ? dobRaw : null;
  const year = dob ? Number(dob.slice(0, 4)) : 0;
  if (!dob || year < 1900 || new Date(dob) > new Date()) back("error=dob");
  if (!referrer || !dept) back("error=referrer");

  // Rate limits: 10 per device per hour, 300 per organization per day.
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  const ipHash = createHash("sha256").update(`referral:${ip}`).digest("hex");
  const counts = await queryOne<{ ip: number; org: number }>(
    `select (select count(*) from referrals where ip_hash = $1 and created_at > now() - interval '1 hour')::int as ip,
            (select count(*) from referrals where org_id = $2 and created_at > now() - interval '1 day')::int as org`,
    [ipHash, org!.id],
  );
  if ((counts?.ip ?? 0) >= 10 || (counts?.org ?? 0) >= 300) back("error=busy");

  const ref = await queryOne<{ id: string }>(
    `insert into referrals (org_id, first_name, last_name, phone, dob, referrer_name, referrer_department, ip_hash)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
    [org!.id, first, last, phone, dob, referrer, dept, ipHash],
  );

  // Every active admin gets it in Notifications (and by push if they turned it on).
  const admins = await query<{ user_id: string }>(
    `select user_id from memberships where org_id = $1 and active and role = 'admin'`,
    [org!.id],
  );
  await Promise.all(
    admins.map((a) =>
      notify(a.user_id, {
        type: "referral",
        title: `New referral: ${first} ${last.charAt(0)}.`,
        body: `From ${referrer}, ${dept}`,
        href: `/referrals#r-${ref!.id}`,
        channels: ["push"],
      }).catch((err) => console.error("[referrals] notify failed", err)),
    ),
  );

  back("sent=1");
}

/* ------------------------------------------------------------------ */
/* Admin: the link                                                     */
/* ------------------------------------------------------------------ */

/** Turns the referral link on (making one the first time) or off. */
export async function setReferralLink(formData: FormData): Promise<void> {
  const { orgId } = await requireAdmin();
  const on = formData.get("enabled") === "1";
  await query(
    `update organizations set referral_enabled = $1, referral_code = coalesce(referral_code, $2) where id = $3`,
    [on, newCode(), orgId],
  );
  revalidatePath("/organization");
  revalidatePath("/referrals");
  redirect(`/organization?saved=${on ? "referral-on" : "referral-off"}#referrals`);
}

/** Makes a new link; the old one stops working right away. */
export async function newReferralLink(): Promise<void> {
  const { orgId } = await requireAdmin();
  await query(`update organizations set referral_code = $1 where id = $2`, [newCode(), orgId]);
  revalidatePath("/organization");
  redirect("/organization?saved=referral-new#referrals");
}

/* ------------------------------------------------------------------ */
/* Admin: the inbox                                                    */
/* ------------------------------------------------------------------ */

type Referral = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  dob: string | Date | null;
  referrer_name: string;
  referrer_department: string;
  created_at: string;
};

async function loadNew(orgId: string, id: string): Promise<Referral> {
  const r = await queryOne<Referral>(
    `select id, first_name, last_name, phone, dob, referrer_name, referrer_department, created_at
       from referrals where id = $1 and org_id = $2 and status = 'new'`,
    [id, orgId],
  );
  if (!r) redirect("/referrals?error=gone");
  return r!;
}

function dobString(v: string | Date | null): string | null {
  if (!v) return null;
  if (typeof v === "string") return v.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
}

/** The note added to the client so everyone sees where they came from. */
async function addReferralNote(userId: string, personId: string, r: Referral): Promise<void> {
  const when = new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const content = `Referred by ${r.referrer_name} (${r.referrer_department}) on ${when}.`;
  const note = await queryOne<{ id: string }>(
    `insert into notes (user_id, content, person_id, category) values ($1, $2, $3, 'referral') returning id`,
    [userId, content, personId],
  );
  await logActivity({ type: "note_added", description: `Note: ${content}`, personId, noteId: note?.id ?? null });
  await query(`update people set last_activity_at = now() where id = $1`, [personId]);
}

/** Accept: creates the client in the organization. */
export async function acceptReferral(formData: FormData): Promise<void> {
  const { userId, orgId } = await requireAdmin();
  await assertCanWrite();
  const r = await loadNew(orgId, formData.get("id")?.toString() ?? "");
  const person = await queryOne<{ id: string }>(
    `insert into people (user_id, first_name, last_name, display_name, phone, birthday)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [userId, r.first_name, r.last_name, `${r.first_name} ${r.last_name}`, r.phone, dobString(r.dob)],
  );
  if (!person) throw new Error("Couldn't create the client.");
  await logActivity({ type: "person_created", description: `${r.first_name} ${r.last_name} added from a referral`, personId: person.id });
  await addReferralNote(userId, person.id, r);
  await query(
    `update referrals set status = 'accepted', person_id = $1, handled_by = $2, handled_at = now() where id = $3`,
    [person.id, userId, r.id],
  );
  revalidatePath("/referrals");
  revalidatePath("/people");
  redirect(`/referrals?saved=accepted&person=${person.id}`);
}

/** Already a client: attaches the referral to an existing organization client. */
export async function matchReferral(formData: FormData): Promise<void> {
  const { userId, orgId } = await requireAdmin();
  await assertCanWrite();
  const r = await loadNew(orgId, formData.get("id")?.toString() ?? "");
  const personId = formData.get("person_id")?.toString() ?? "";
  const person = await queryOne<{ id: string }>(
    `select id from people where id = $1 and org_id = $2 and deleted_at is null`,
    [personId, orgId],
  );
  if (!person) redirect("/referrals?error=match");
  await addReferralNote(userId, person!.id, r);
  await query(
    `update referrals set status = 'matched', person_id = $1, handled_by = $2, handled_at = now() where id = $3`,
    [person!.id, userId, r.id],
  );
  revalidatePath("/referrals");
  redirect(`/referrals?saved=matched&person=${person!.id}`);
}

/** Decline, with an optional reason kept in the log. */
export async function declineReferral(formData: FormData): Promise<void> {
  const { userId, orgId } = await requireAdmin();
  await assertCanWrite();
  const r = await loadNew(orgId, formData.get("id")?.toString() ?? "");
  const reason = clean(formData.get("reason"), 500) || null;
  await query(
    `update referrals set status = 'declined', decline_reason = $1, handled_by = $2, handled_at = now() where id = $3`,
    [reason, userId, r.id],
  );
  revalidatePath("/referrals");
  redirect("/referrals?saved=declined");
}
