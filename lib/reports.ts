import { query, queryOne } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { getMembership } from "@/lib/org";
import { getTimeZone } from "@/lib/timezone";
import { getOrgTimeZone } from "@/lib/referral-settings";
import { cleanTiles, type Audience, type TileKey } from "@/lib/dashboard-shared";
import type { DashScope } from "@/lib/dashboard";

/**
 * Who may see dashboards and schedule reports. Same rule as Impact/Insights: an
 * organization's Admins and Managers report on the organization; Members don't get
 * reports; a solo account reports on its own records.
 */
export type ReportAccess = { userId: string; scope: DashScope; tz: string; audience: Audience; orgName: string | null };

export async function reportAccess(): Promise<ReportAccess | null> {
  const userId = await requireUserId();
  const m = await getMembership();
  if (m?.active) {
    if (m.role === "case_manager") return null;
    return { userId, scope: { orgId: m.orgId, userId }, tz: await getOrgTimeZone(m.orgId), audience: m.orgKind, orgName: m.orgName };
  }
  return { userId, scope: { orgId: null, userId }, tz: await getTimeZone(), audience: "individual", orgName: null };
}

export async function dashboardTiles(a: ReportAccess): Promise<TileKey[]> {
  const r = await queryOne<{ tiles: string[] }>(`select tiles from dashboard_layouts where user_id = $1`, [a.userId]);
  return cleanTiles(r?.tiles ?? [], a.audience);
}

/** Choices for the filters, from the account's own lists only. */
export async function filterChoices(a: ReportAccess) {
  const where = a.scope.orgId ? "org_id = $1" : "org_id is null and user_id = $1";
  const param = a.scope.orgId ?? a.userId;
  const [members, services, programs] = await Promise.all([
    a.scope.orgId
      ? query<{ id: string; name: string }>(
          `select u.id, coalesce(nullif(trim(u.name), ''), u.email) as name from memberships m join users u on u.id = m.user_id
            where m.org_id = $1 and m.active order by lower(coalesce(u.name, u.email))`,
          [a.scope.orgId],
        )
      : Promise.resolve([]),
    query<{ id: string; name: string }>(`select id, name from services where ${where} and archived_at is null order by lower(name)`, [param]),
    query<{ id: string; label: string; options: string[] }>(
      `select id, label, coalesce(options, '{}') as options from custom_fields where ${where} and archived_at is null and kind = 'choice' order by position, lower(label)`,
      [param],
    ),
  ]);
  return { members, services, programs };
}

export type ScheduleView = {
  id: string;
  name: string;
  frequency: "weekly" | "monthly";
  weekday: number;
  monthDay: number;
  hour: number;
  recipients: "me" | "managers";
  attachPdf: boolean;
  tiles: TileKey[];
  enabled: boolean;
  ownerName: string | null;
  lastSent: string | null;
  lastStatus: string | null;
};

export async function listSchedules(a: ReportAccess): Promise<ScheduleView[]> {
  const rows = await query<{
    id: string;
    name: string;
    frequency: "weekly" | "monthly";
    weekday: number;
    month_day: number;
    hour: number;
    recipients: "me" | "managers";
    attach_pdf: boolean;
    tiles: TileKey[];
    enabled: boolean;
    owner: string | null;
    last_sent: string | null;
    last_status: string | null;
  }>(
    `select s.id, s.name, s.frequency, s.weekday, s.month_day, s.hour, s.recipients, s.attach_pdf, s.tiles, s.enabled,
            coalesce(nullif(trim(u.name), ''), u.email) as owner,
            (select max(updated_at) from report_deliveries d where d.schedule_id = s.id and d.status = 'sent') as last_sent,
            (select d.status from report_deliveries d where d.schedule_id = s.id order by d.updated_at desc limit 1) as last_status
       from report_schedules s join users u on u.id = s.user_id
      where ${a.scope.orgId ? "s.org_id = $1" : "s.org_id is null and s.user_id = $1"} and s.deleted_at is null
      order by s.created_at`,
    [a.scope.orgId ?? a.userId],
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    frequency: r.frequency,
    weekday: r.weekday,
    monthDay: r.month_day,
    hour: r.hour,
    recipients: r.recipients,
    attachPdf: r.attach_pdf,
    tiles: r.tiles,
    enabled: r.enabled,
    ownerName: r.owner,
    lastSent: r.last_sent,
    lastStatus: r.last_status,
  }));
}
