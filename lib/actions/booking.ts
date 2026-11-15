"use server";

import { createHash } from "crypto";
import { after } from "next/server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { query, queryOne } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { assertCanWrite } from "@/lib/billing";
import { isValidTimeZone } from "@/lib/tz";
import { cleanHours, minutesOf, SLOT_CHOICES, formatSlot, type WeeklyHours } from "@/lib/referral-slots";
import { bookingPageByCode, myBookingPage, newBookingCode, openBookingSlots } from "@/lib/booking";
import { getAppSettings, inMaintenance } from "@/lib/app-settings";
import { isEmail } from "@/lib/email-check";
import { escapeHtml, sendEmail } from "@/lib/email";
import { notify } from "@/lib/notify";
import { logEvent } from "@/lib/events";

function clean(v: FormDataEntryValue | null, max: number): string {
  return (v?.toString() ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

/* ------------------------------------------------------------------ */
/* Settings → Booking link                                             */
/* ------------------------------------------------------------------ */

export async function saveBookingPage(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  await assertCanWrite();
  const fail = (e: string) => redirect(`/settings/booking?error=${e}`);
  await myBookingPage(userId); // makes the row the first time
  if (formData.get("action") === "new-link") {
    await query(`update booking_pages set code = $2, updated_at = now() where user_id = $1`, [userId, newBookingCode()]);
    revalidatePath("/settings/booking");
    redirect("/settings/booking?saved=new-link");
  }
  const enabled = formData.get("enabled") === "1";
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
  if (enabled && Object.keys(cleanHours(hours)).length === 0) fail("no-hours");
  const slot = Number(formData.get("slot_minutes"));
  if (!(SLOT_CHOICES as readonly number[]).includes(slot)) fail("slot");
  const tz = clean(formData.get("timezone"), 64);
  if (!isValidTimeZone(tz)) fail("timezone");
  const rawMax = clean(formData.get("max_per_day"), 3);
  const max = rawMax ? Number(rawMax) : null;
  if (max !== null && (!Number.isInteger(max) || max < 1 || max > 100)) fail("max");
  await query(
    `update booking_pages set enabled = $2, title = $3, hours = $4, slot_minutes = $5, timezone = $6, location = $7, max_per_day = $8, updated_at = now()
      where user_id = $1`,
    [userId, enabled, clean(formData.get("title"), 80) || null, JSON.stringify(hours), slot, tz, clean(formData.get("location"), 300) || null, max],
  );
  revalidatePath("/settings/booking");
  redirect("/settings/booking?saved=booking");
}

/* ------------------------------------------------------------------ */
/* The public page (/book/<code>): no sign-in                           */
/* ------------------------------------------------------------------ */

export async function submitBooking(formData: FormData): Promise<void> {
  const code = clean(formData.get("code"), 40);
  const back = (q: string) => redirect(`/book/${encodeURIComponent(code)}?${q}`);
  const page = await bookingPageByCode(code);
  if (!page) back("error=closed");
  if (inMaintenance(await getAppSettings())) back("error=paused");
  if (clean(formData.get("website"), 200)) back("booked=1"); // spam trap people never see

  const name = clean(formData.get("name"), 120);
  const email = clean(formData.get("email"), 254).toLowerCase();
  const phone = clean(formData.get("phone"), 40).replace(/[^\d+()\-. ]/g, "");
  const note = (formData.get("note")?.toString() ?? "").trim().slice(0, 1000);
  if (name.length < 2) back("error=name");
  if (email && !isEmail(email)) back("error=email");
  if (!email && phone.replace(/\D/g, "").length < 7) back("error=contact");
  const at = Number(formData.get("at"));
  if (!Number.isFinite(at)) back("error=slot");

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  const ipHash = createHash("sha256").update(`booking:${ip}`).digest("hex");
  const counts = await queryOne<{ ip: number; person: number }>(
    `select (select count(*) from bookings where ip_hash = $1 and created_at > now() - interval '1 hour')::int as ip,
            (select count(*) from bookings where user_id = $2 and canceled_at is null and starts_at > now()
               and (($3 <> '' and lower(email) = $3) or ($4 <> '' and regexp_replace(phone, '\\D', '', 'g') = $4)))::int as person`,
    [ipHash, page!.userId, email, phone.replace(/\D/g, "")],
  );
  if ((counts?.ip ?? 0) >= 5) back("error=busy");
  if ((counts?.person ?? 0) >= 3) back("error=many");

  const open = await openBookingSlots(page!);
  const slot = open.find((s) => s.getTime() === at);
  if (!slot) back("error=taken");

  // Saving the booking first claims the time (a unique index stops two people booking the same one).
  const booking = await queryOne<{ id: string }>(
    `insert into bookings (user_id, name, email, phone, note, starts_at, ip_hash) values ($1, $2, $3, $4, $5, $6, $7)
     on conflict do nothing returning id`,
    [page!.userId, name, email || null, phone || null, note || null, slot!, ipHash],
  );
  if (!booking) back("error=taken");

  // The person: an existing one with this email or phone, or a new one (owned by the page's owner).
  const digits = phone.replace(/\D/g, "");
  let person = await queryOne<{ id: string }>(
    `select id from people where user_id = $1 and deleted_at is null
        and (($2 <> '' and lower(email) = $2) or (length($3) >= 7 and regexp_replace(coalesce(phone, ''), '\\D', '', 'g') = $3))
      order by last_activity_at desc limit 1`,
    [page!.userId, email, digits],
  );
  if (!person) {
    const [first, ...rest] = name.split(" ");
    person = await queryOne<{ id: string }>(
      `insert into people (user_id, first_name, last_name, display_name, email, phone, next_action)
       values ($1, $2, $3, $4, $5, $6, 'Booked online') returning id`,
      [page!.userId, first, rest.join(" ") || null, name, email || null, phone || null],
    );
  }
  const when = formatSlot(slot!, page!.tz);
  const task = await queryOne<{ id: string }>(
    `insert into tasks (user_id, title, person_id, due_at, notes) values ($1, $2, $3, $4, $5) returning id`,
    [page!.userId, `Appointment: ${name}`, person!.id, slot!, [note, email, phone].filter(Boolean).join("\n") || null],
  );
  await query(`update bookings set person_id = $2, task_id = $3 where id = $1`, [booking!.id, person!.id, task!.id]);
  await query(`update people set last_activity_at = now() where id = $1`, [person!.id]);

  const ownerEmail = page!.ownerEmail;
  after(async () => {
    await notify(page!.userId, {
      type: "booking",
      title: `New booking: ${name}`,
      body: when,
      href: `/people/${person!.id}`,
      personId: person!.id,
      taskId: task!.id,
      channels: ["push"],
    }).catch((err) => console.error("[booking] notify failed", err));
    await logEvent("booking.made", `Booking on ${page!.ownerName}'s page`, { meta: { owner: page!.userId } });
    if (email) {
      const where = page!.location ? `\nWhere: ${page!.location}` : "";
      await sendEmail({
        to: email,
        replyTo: ownerEmail,
        subject: `You're booked: ${when}`,
        text: `Hi ${name.split(" ")[0]},\n\nYou're booked with ${page!.ownerName} on ${when} (${page!.tz.replace(/_/g, " ")}).${where}\n\nNeed to change it? Just reply to this email.\n\nBooked with Surfdesk. Try it free: https://thesurfdesk.app/get-started?utm_source=booking&utm_medium=email`,
        html: `<div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#141412;max-width:480px">
<p>Hi ${escapeHtml(name.split(" ")[0])},</p>
<p>You're booked with <strong>${escapeHtml(page!.ownerName)}</strong> on <strong>${escapeHtml(when)}</strong> (${escapeHtml(page!.tz.replace(/_/g, " "))}).</p>
${page!.location ? `<p>Where: ${escapeHtml(page!.location)}</p>` : ""}
<p>Need to change it? Just reply to this email.</p>
<p style="color:#6e5f4d;font-size:12px;margin-top:24px">Booked with Surfdesk. <a href="https://thesurfdesk.app/get-started?utm_source=booking&utm_medium=email">Try it free</a></p>
</div>`,
      }).catch((err) => console.error("[booking] confirmation email failed", err));
    }
  });
  back(`booked=1&at=${slot!.getTime()}`);
}
