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
import { appUrl, escapeHtml, sendEmail } from "@/lib/email";
import { logEvent } from "@/lib/events";
import { loadReferralSettings, openSlots } from "@/lib/referral-settings";
import { SLOT_CHOICES, cleanHours, formatSlot, minutesOf, type WeeklyHours } from "@/lib/referral-slots";
import { isValidTimeZone } from "@/lib/tz";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Multi-line text: trims and caps, keeps line breaks. */
const cleanText = (v: FormDataEntryValue | null, max: number) =>
  (v?.toString() ?? "").replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);

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
  const referrerEmail = clean(formData.get("referrer_email"), 254).toLowerCase();
  const notes = cleanText(formData.get("notes"), 2000) || null;

  if (!first || !last) back("error=name");
  if (phone.replace(/\D/g, "").length < 7) back("error=phone");
  const dob = /^\d{4}-\d{2}-\d{2}$/.test(dobRaw) ? dobRaw : null;
  const year = dob ? Number(dob.slice(0, 4)) : 0;
  if (!dob || year < 1900 || new Date(dob) > new Date()) back("error=dob");
  if (!referrer || !dept) back("error=referrer");
  if (!EMAIL_RE.test(referrerEmail)) back("error=email");

  const settings = await loadReferralSettings(org!.id);
  // One service: from the organization's list, or typed in under "Other".
  const picked = clean(formData.get("service"), 80);
  const typed = cleanText(formData.get("service_other"), 80).replace(/\s+/g, " ").trim();
  const service = picked === "__other__" ? typed : settings.services.includes(picked) ? picked : "";
  const services = service ? [service] : [];

  // Appointment: re-checked here against hours, bookings and limits. If every
  // time is full, the referral still goes through and waits for the next opening.
  let appointment: Date | null = null;
  let waitlisted = false;
  if (settings.appointments) {
    // A shorter cutoff than the form shows, so a time picked a few minutes ago still counts.
    const plan = await openSlots(org!.id, settings, new Date(), 15);
    if (plan.open.length === 0) {
      waitlisted = true;
    } else {
      const picked = Number(formData.get("slot"));
      appointment = plan.open.find((t) => t.getTime() === picked) ?? null;
      if (!appointment) back("error=slot");
    }
  }

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

  let ref: { id: string } | null = null;
  try {
    ref = await queryOne<{ id: string }>(
      `insert into referrals (org_id, first_name, last_name, phone, dob, referrer_name, referrer_department, ip_hash,
                              referrer_email, services, notes, appointment_at, waitlisted, location)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) returning id`,
      [org!.id, first, last, phone, dob, referrer, dept, ipHash, referrerEmail, services, notes, appointment, waitlisted, settings.location || null],
    );
  } catch (err) {
    // Someone booked the same time a moment earlier (one client per slot).
    if ((err as { code?: string }).code === "23505") back("error=taken");
    throw err;
  }
  const when = appointment ? formatSlot(appointment, settings.tz) : null;

  // Every active admin gets it in Notifications (and by push if they turned it on).
  const admins = await query<{ user_id: string }>(
    `select user_id from memberships where org_id = $1 and active and role = 'admin'`,
    [org!.id],
  );
  // Each admin gets the appointment on their Calendar and task list.
  if (appointment) {
    for (const a of admins) {
      await query(
        `insert into tasks (user_id, title, notes, due_at, referral_id) values ($1, $2, $3, $4, $5)`,
        [
          a.user_id,
          `Referral appointment: ${first} ${last}`,
          [`Referred by ${referrer} (${dept}).`, settings.location ? `Location: ${settings.location}.` : "", services.length ? `Services: ${services.join(", ")}.` : "", notes ? `Notes: ${notes}` : ""]
            .filter(Boolean)
            .join("\n"),
          appointment,
          ref!.id,
        ],
      ).catch((err) => console.error("[referrals] appointment task failed", err));
    }
  }
  await Promise.all(
    admins.map((a) =>
      notify(a.user_id, {
        type: "referral",
        title: `New referral: ${first} ${last.charAt(0)}.`,
        body: `From ${referrer}, ${dept}. ${when ? `Appointment ${when}.` : waitlisted ? "Fully booked: needs the next opening." : ""}`.trim(),
        href: `/referrals#r-${ref!.id}`,
        channels: ["push"],
      }).catch((err) => console.error("[referrals] notify failed", err)),
    ),
  );

  await logEvent("referral.received", `Referral to ${org!.name}${when ? ` · ${when}` : waitlisted ? " · waitlisted" : ""}`, {
    email: referrerEmail,
    meta: { org: org!.id, referral: ref!.id },
  });
  // Anyone can type any address here, so cap confirmations per address: the form
  // can't be used to flood a stranger's inbox (or hurt our sender reputation).
  const sentToday = await queryOne<{ n: number }>(
    `select count(*)::int as n from referrals where lower(referrer_email) = $1 and created_at > now() - interval '1 day'`,
    [referrerEmail],
  );
  const mayEmail = (sentToday?.n ?? 0) <= 5;
  if (!mayEmail) await logEvent("referral.email_capped", `Confirmation not sent: ${referrerEmail} got 5 today`, { level: "warn", email: referrerEmail });
  if (mayEmail) await sendReferralConfirmation(referrerEmail, org!.name, `${first} ${last.charAt(0)}.`, when, waitlisted, settings.location).catch(async (err) => {
    console.error("[referrals] confirmation email failed", err);
    await logEvent("email.failed", `Referral confirmation to ${referrerEmail} failed: ${err instanceof Error ? err.message : err}`, {
      level: "warn",
      email: referrerEmail,
    });
  });

  back(appointment ? `sent=1&at=${appointment.getTime()}` : waitlisted ? "sent=1&wait=1" : "sent=1");
}

/** Lets the person who referred know it arrived, and when the appointment is. */
async function sendReferralConfirmation(
  to: string,
  orgName: string,
  client: string,
  when: string | null,
  waitlisted: boolean,
  location: string,
) {
  const line = when
    ? `${client} has an appointment with ${orgName} on ${when}.`
    : waitlisted
      ? `${orgName} is fully booked right now, so ${client} will be contacted for the next available appointment.`
      : `${orgName} will reach out to ${client}.`;
  await sendEmail({
    to,
    subject: when ? `Referral received: ${client}, ${when}` : `Referral received: ${client}`,
    text: `Thank you for your referral.\n\n${line}${location ? `\nLocation: ${location}` : ""}\n\nSent with Strynd (${appUrl()}).`,
    html: `<div style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#141412">
      <p style="margin:0 0 12px">Thank you for your referral.</p>
      <p style="margin:0 0 12px"><strong>${escapeHtml(line)}</strong></p>${
        location ? `<p style="margin:0 0 12px">Location: ${escapeHtml(location)}</p>` : ""
      }
      <p style="margin:16px 0 0;color:#6e5f4d;font-size:13px">Sent with Strynd.</p></div>`,
  });
}

/* ------------------------------------------------------------------ */
/* Admin: referral settings                                            */
/* ------------------------------------------------------------------ */

/** Organization → Referral settings: appointment hours, slot length, limits and the services list. */
export async function saveReferralSettings(formData: FormData): Promise<void> {
  const { orgId } = await requireAdmin();
  await assertCanWrite(); // not before the trial starts or after a subscription lapses (stops invite/referral email abuse)
  const fail = (e: string) => redirect(`/organization?error=${e}#referral-settings`);
  const appointments = formData.get("appointments") === "1";
  const hours: WeeklyHours = {};
  for (let d = 0; d <= 6; d++) {
    if (formData.get(`open_${d}`) !== "1") continue;
    const start = clean(formData.get(`start_${d}`), 5);
    const end = clean(formData.get(`end_${d}`), 5);
    const a = minutesOf(start);
    const b = minutesOf(end);
    if (a === null || b === null || a >= b) fail("hours");
    hours[String(d)] = [[start, end]];
  }
  if (appointments && Object.keys(cleanHours(hours)).length === 0) fail("no-hours");
  const slot = Number(formData.get("slot_minutes"));
  if (!(SLOT_CHOICES as readonly number[]).includes(slot)) fail("slot");
  const cap = (k: string) => {
    const raw = clean(formData.get(k), 6);
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > 10000) fail("limits");
    return n;
  };
  const tz = clean(formData.get("timezone"), 64);
  if (!isValidTimeZone(tz)) fail("timezone");
  const location = cleanText(formData.get("location"), 300).replace(/\s+/g, " ").trim() || null;
  await query(
    `update organizations set referral_appointments = $1, referral_hours = $2, referral_slot_minutes = $3,
            referral_max_day = $4, referral_max_week = $5, referral_max_month = $6,
            referral_timezone = $7, referral_location = $9
      where id = $8`,
    [appointments, JSON.stringify(hours), slot, cap("max_day"), cap("max_week"), cap("max_month"), tz, orgId, location],
  );
  revalidatePath("/organization");
  redirect("/organization?saved=referral-settings#referral-settings");
}

/* ------------------------------------------------------------------ */
/* Admin: the link                                                     */
/* ------------------------------------------------------------------ */

/** Turns the referral link on (making one the first time) or off. */
export async function setReferralLink(formData: FormData): Promise<void> {
  const { orgId } = await requireAdmin();
  await assertCanWrite(); // not before the trial starts or after a subscription lapses (stops invite/referral email abuse)
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
  await assertCanWrite(); // not before the trial starts or after a subscription lapses (stops invite/referral email abuse)
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
  appointment_at: string | null;
  services: string[] | null;
  notes: string | null;
};

async function loadNew(orgId: string, id: string): Promise<Referral> {
  const r = await queryOne<Referral>(
    `select id, first_name, last_name, phone, dob, referrer_name, referrer_department, created_at,
            appointment_at, services, notes
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
  const content = [
    `Referred by ${r.referrer_name} (${r.referrer_department}) on ${when}.`,
    r.services?.length ? `Services: ${r.services.join(", ")}.` : "",
    r.notes ? `Notes: ${r.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
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
  await query(`update tasks set person_id = $1, updated_at = now() where referral_id = $2 and deleted_at is null`, [person.id, r.id]);
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
  await query(`update tasks set person_id = $1, updated_at = now() where referral_id = $2 and deleted_at is null`, [person!.id, r.id]);
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
  // The time slot frees up; the appointment comes off admins' calendars.
  await query(`update tasks set deleted_at = now() where referral_id = $1 and completed = false and deleted_at is null`, [r.id]);
  revalidatePath("/referrals");
  redirect("/referrals?saved=declined");
}
