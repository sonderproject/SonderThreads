import { randomBytes } from "crypto";
import { query, queryOne } from "@/lib/db/client";
import { isValidTimeZone } from "@/lib/tz";
import { DEFAULT_HOURS, DEFAULT_SLOT_MINUTES, cleanHours, generateSlots, planSlots, type WeeklyHours } from "@/lib/referral-slots";
import { FALLBACK_TZ } from "@/lib/referral-settings";

/**
 * Booking link (Settings → Booking link): a public page (/book/<code>) where
 * anyone can pick a time with this person. Uses the same open-hours slots as
 * the referral form. A time is offered only if it's free: not already booked,
 * and not overlapping one of the owner's timed tasks. Each booking matches or
 * adds the person and puts an appointment task on the owner's list.
 */
export type BookingPage = {
  userId: string;
  code: string;
  enabled: boolean;
  title: string;
  hours: WeeklyHours;
  slotMinutes: number;
  tz: string;
  location: string;
  maxPerDay: number | null;
  ownerName: string;
};

type Row = {
  user_id: string;
  code: string;
  enabled: boolean;
  title: string | null;
  hours: unknown;
  slot_minutes: number;
  timezone: string | null;
  location: string | null;
  max_per_day: number | null;
  user_tz: string | null;
  owner_name: string | null;
  owner_email: string;
};

const SELECT = `select b.*, u.timezone as user_tz, coalesce(u.name, split_part(u.email, '@', 1)) as owner_name, u.email as owner_email
                  from booking_pages b join users u on u.id = b.user_id`;

function toPage(r: Row): BookingPage {
  const tz = [r.timezone, r.user_tz].find((z) => isValidTimeZone(z)) ?? FALLBACK_TZ;
  return {
    userId: r.user_id,
    code: r.code,
    enabled: r.enabled,
    title: r.title?.trim() || `Book a time with ${r.owner_name ?? "me"}`,
    hours: r.hours == null ? DEFAULT_HOURS : cleanHours(r.hours),
    slotMinutes: r.slot_minutes || DEFAULT_SLOT_MINUTES,
    tz,
    location: r.location?.trim() ?? "",
    maxPerDay: r.max_per_day,
    ownerName: r.owner_name ?? "",
  };
}

export function newBookingCode(): string {
  return randomBytes(9).toString("base64url");
}

/** The signed-in person's booking page (made, turned off, the first time it's opened). */
export async function myBookingPage(userId: string): Promise<BookingPage> {
  let r = await queryOne<Row>(`${SELECT} where b.user_id = $1`, [userId]);
  if (!r) {
    await query(`insert into booking_pages (user_id, code) values ($1, $2) on conflict (user_id) do nothing`, [userId, newBookingCode()]);
    r = await queryOne<Row>(`${SELECT} where b.user_id = $1`, [userId]);
  }
  return toPage(r!);
}

/** A public booking page by its link code: only if it's on and its owner (and their organization) isn't suspended. */
export async function bookingPageByCode(code: string): Promise<(BookingPage & { ownerEmail: string }) | null> {
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(code)) return null;
  const r = await queryOne<Row>(
    `${SELECT} where b.code = $1 and b.enabled and u.suspended_at is null
       and not exists (select 1 from memberships m join organizations o on o.id = m.org_id
                        where m.user_id = u.id and m.active and o.suspended_at is not null)`,
    [code],
  );
  return r ? { ...toPage(r), ownerEmail: r.owner_email } : null;
}

/** Bookable times now (next 14 days), skipping booked times and the owner's timed tasks. */
export async function openBookingSlots(page: BookingPage, now = new Date()): Promise<Date[]> {
  const slots = generateSlots({ hours: page.hours, slotMinutes: page.slotMinutes, tz: page.tz, now });
  const [booked, busy] = await Promise.all([
    query<{ starts_at: Date }>(
      `select starts_at from bookings where user_id = $1 and canceled_at is null and starts_at > now() - interval '1 day' and starts_at < now() + interval '20 days'`,
      [page.userId],
    ),
    // Timed tasks only: all-day ones (midnight in their time zone) don't block a time.
    query<{ due_at: Date }>(
      `select t.due_at from tasks t join users u on u.id = t.user_id
        where t.user_id = $1 and not t.completed and t.deleted_at is null
          and t.due_at > now() and t.due_at < now() + interval '20 days'
          and (t.due_at at time zone coalesce(u.timezone, 'UTC'))::time <> '00:00'`,
      [page.userId],
    ),
  ]);
  const len = page.slotMinutes * 60_000;
  const busyTimes = busy.map((b) => new Date(b.due_at).getTime());
  const free = slots.filter((s) => !busyTimes.some((t) => t >= s.getTime() && t < s.getTime() + len));
  const plan = planSlots({
    slots: free,
    booked: booked.map((b) => new Date(b.starts_at)),
    caps: { day: page.maxPerDay, week: null, month: null },
    tz: page.tz,
  });
  return plan.open;
}
