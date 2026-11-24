import type { SettingsSlug } from "@/lib/settings-sections";

/**
 * What each kind of account gets (owner's decision, Nov 24, 2026).
 *
 * Individual ($9): the personal organizer plus light client work: home and command box,
 * tasks, notes, lists, calendar and sync, reminders, voice, people and meetings, booking
 * link, services and revenue, the simple follow-up switches, and their own Insights.
 *
 * Business (any organization, from one seat at $19): adds smart forms, custom automations,
 * the reports dashboard and scheduled emails, PDF reports, outcomes, custom fields,
 * referrals, team and messages.
 *
 * Hidden features keep their data: it comes back if the account upgrades.
 */
export const BUSINESS_FEATURES = [
  "Smart forms with a link and QR code",
  "Automations: when this happens, do that",
  "Reports dashboard and scheduled report emails",
  "Branded PDF reports",
  "Outcomes and custom fields on every profile",
  "Team chat, roles and a shared client list when you grow",
] as const;

/** Settings sections each kind of account sees. Business accounts find follow-ups on the Automations page. */
export function settingsSectionVisible(slug: SettingsSlug, business: boolean): boolean {
  if (!business && (slug === "outcomes" || slug === "fields")) return false;
  if (business && slug === "automations") return false;
  return true;
}
