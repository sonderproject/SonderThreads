import { query, queryOne } from "@/lib/db/client";
import { isValidTimeZone } from "@/lib/tz";
import {
  DEFAULT_HOURS,
  DEFAULT_SLOT_MINUTES,
  cleanHours,
  generateSlots,
  planSlots,
  type Caps,
  type SlotPlan,
  type WeeklyHours,
} from "@/lib/referral-slots";

export const FALLBACK_TZ = "America/Los_Angeles";
export const MAX_SERVICES = 30;

export type ReferralSettings = {
  appointments: boolean;
  hours: WeeklyHours;
  slotMinutes: number;
  tz: string;
  services: string[];
  caps: Caps;
};

/** An organization's referral settings, with the defaults (Mon–Fri 10–1, 30-minute slots) filled in. */
export async function loadReferralSettings(orgId: string): Promise<ReferralSettings> {
  const r = await queryOne<{
    referral_appointments: boolean;
    referral_hours: unknown;
    referral_slot_minutes: number;
    referral_timezone: string | null;
    creator_tz: string | null;
    referral_services: string[] | null;
    referral_max_day: number | null;
    referral_max_week: number | null;
    referral_max_month: number | null;
  }>(
    `select o.referral_appointments, o.referral_hours, o.referral_slot_minutes, o.referral_timezone, u.timezone as creator_tz,
            o.referral_services, o.referral_max_day, o.referral_max_week, o.referral_max_month
       from organizations o left join users u on u.id = o.created_by
      where o.id = $1`,
    [orgId],
  );
  const tz = [r?.referral_timezone, r?.creator_tz].find((z) => isValidTimeZone(z)) ?? FALLBACK_TZ;
  return {
    appointments: r?.referral_appointments ?? true,
    hours: r?.referral_hours == null ? DEFAULT_HOURS : cleanHours(r.referral_hours),
    slotMinutes: r?.referral_slot_minutes ?? DEFAULT_SLOT_MINUTES,
    tz,
    services: r?.referral_services ?? [],
    caps: { day: r?.referral_max_day ?? null, week: r?.referral_max_week ?? null, month: r?.referral_max_month ?? null },
  };
}

/** Bookable appointment times right now, counting appointments already booked (declined ones free their slot). */
export async function openSlots(orgId: string, settings: ReferralSettings, now = new Date()): Promise<SlotPlan> {
  const slots = generateSlots({ hours: settings.hours, slotMinutes: settings.slotMinutes, tz: settings.tz, now });
  // Wide enough to cover this month's and next month's counts.
  const booked = await query<{ appointment_at: Date }>(
    `select appointment_at from referrals
      where org_id = $1 and appointment_at is not null and status <> 'declined'
        and appointment_at > now() - interval '40 days' and appointment_at < now() + interval '75 days'`,
    [orgId],
  );
  return planSlots({ slots, booked: booked.map((b) => new Date(b.appointment_at)), caps: settings.caps, tz: settings.tz });
}
