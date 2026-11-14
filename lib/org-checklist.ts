import { queryOne } from "@/lib/db/client";

export type ChecklistItem = { key: string; label: string; hint: string; href: string; done: boolean };

/**
 * Team page, admins: the "Finish setting up" checklist after the guided
 * set-up. Items tick themselves off from real data. Null once everything is
 * done or an admin dismissed it.
 */
export async function getOrgChecklist(orgId: string, reportWord: string): Promise<ChecklistItem[] | null> {
  const r = await queryOne<{
    dismissed: boolean;
    members: number;
    invites: number;
    clients: number;
    services: number;
    intake: boolean;
    report: boolean;
  }>(
    `select o.setup_checklist_dismissed_at is not null as dismissed,
            (select count(*) from memberships m where m.org_id = o.id and m.active)::int as members,
            (select count(*) from invitations i where i.org_id = o.id and i.accepted_at is null and i.expires_at > now())::int as invites,
            (select count(*) from people p where p.org_id = o.id and p.deleted_at is null and not p.is_sample)::int as clients,
            (select count(*) from services s where s.org_id = o.id and s.archived_at is null)::int as services,
            (o.referral_enabled or exists (
               select 1 from memberships m join user_settings us on us.user_id = m.user_id
                where m.org_id = o.id and m.active and us.kiosk_pin_hash is not null)) as intake,
            o.first_report_at is not null as report
       from organizations o where o.id = $1`,
    [orgId],
  );
  if (!r || r.dismissed) return null;
  const items: ChecklistItem[] = [
    { key: "staff", label: "Invite your staff", hint: "Everyone's work in one place.", href: "/organization", done: r.members > 1 || r.invites > 0 },
    { key: "clients", label: "Bring in your clients", hint: "Upload your list from Excel or a CSV file.", href: "/settings/data#import", done: r.clients > 0 },
    { key: "services", label: "Add your services", hint: "Log them in one tap; they show up in reports.", href: "/settings/services", done: r.services > 0 },
    {
      key: "intake",
      label: "Turn on the front-desk kiosk or referral link",
      hint: "Sign-ins and referrals land in Surfdesk by themselves.",
      href: "/organization#referrals",
      done: r.intake,
    },
    { key: "report", label: `Download your first ${reportWord} report`, hint: "PDF or Excel, ready for your board or funders.", href: "/impact", done: r.report },
  ];
  return items.every((i) => i.done) ? null : items;
}
