import Link from "next/link";
import { ORG_KINDS, ORG_KINDS_SAME } from "@/lib/terms";
import { OrgKindText } from "@/components/org/OrgKindText";
import { SeatSummary } from "@/components/org/SeatSummary";
import { redirect } from "next/navigation";
import { asUser } from "@/lib/db/as-user";
import { queryOne } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { getMembership, ORG_ROLES, ROLE_LABELS, type OrgRole } from "@/lib/org";
import {
  changeRole,
  deactivateMember,
  reactivateMember,
  reassignAllClients,
  removeOrgLogo,
  revokeInvite,
  saveOrganizationInfo,
  setOrgKind,
  setMemberDataRules,
  uploadOrgLogo,
} from "@/lib/actions/org";
import { InviteForm } from "@/components/org/InviteForm";
import { CopyInviteLink } from "@/components/org/CopyInviteLink";
import { CopyText } from "@/components/org/CopyText";
import { BulkInviteCard } from "@/components/org/BulkInviteCard";
import { BulkRoleChange } from "@/components/org/BulkRoleChange";
import { saveTeamLink } from "@/lib/actions/team-invites";
import { emailDomain, PUBLIC_EMAIL_DOMAINS } from "@/lib/bulk-invite";
import { newReferralLink, setReferralLink } from "@/lib/actions/referrals";
import { appUrl } from "@/lib/email";
import { seatUsage } from "@/lib/billing";
import { loadReferralSettings } from "@/lib/referral-settings";
import { ReferralSettingsCard } from "@/components/org/ReferralSettingsCard";

const ERRORS: Record<string, string> = {
  "last-admin": "An organization needs at least one active admin. Make someone else an admin first.",
  seats: "All your seats are in use. Add seats in Billing, or cancel a pending invite.",
  hours: "Check the open hours: each open day needs a start time before its end time.",
  "no-hours": "Open at least one day, or turn off appointment booking.",
  slot: "Choose an appointment length.",
  limits: "Limits must be whole numbers from 1 to 10,000, or left blank.",
  timezone: "Choose a time zone.",
  self: "You can't deactivate yourself.",
  reassign: "Choose an active staff member to take over their clients.",
  role: "Choose a role.",
  name: "Enter a name.",
  "org-email": "Enter a valid email address for the organization.",
  "logo-missing": "Choose an image file first.",
  "logo-size": "That logo is over 1 MB. Try a smaller PNG or JPG.",
  "logo-type": "The logo must be a PNG or JPG image.",
  "team-link-public": "Free email domains like gmail.com can't be used: anyone could join. Use your organization's own domain.",
  "team-link-domains": "Enter your organization's email domain, like agency.org.",
  "bulk-none": "Select at least one person (you can't change your own role here).",
};
const SAVED: Record<string, string> = {
  role: "Role updated.",
  deactivated: "Deactivated. Their clients were handed over.",
  reactivated: "Reactivated.",
  "referral-settings": "Referral settings saved.",
  name: "Name updated.",
  info: "Organization info saved.",
  kind: "Organization type updated. The app's words and reports now match it.",
  "member-rules": "Member data rules saved.",
  logo: "Logo updated.",
  "logo-removed": "Logo removed.",
  moved: "Clients moved. The person they're now assigned to was notified.",
  "referral-on": "Referral link is on.",
  "referral-off": "Referral link is off. It won't accept referrals until you turn it back on.",
  "referral-new": "New referral link made. The old one no longer works.",
  "team-link": "Team link ready. Copy it now: for security it's only shown once (you can always make a new one).",
  "team-link-off": "Team link is off. It no longer lets anyone join.",
  "bulk-role": "Roles updated.",
};

type Member = { user_id: string; role: OrgRole; active: boolean; name: string | null; email: string; clients: number };
type OrgInfo = {
  name: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  about: string | null;
  logo_version: string | null;
  referral_code: string | null;
  referral_enabled: boolean;
  kind: "nonprofit" | "business";
  team_link_on: boolean;
  join_domains: string[] | null;
};
type Invite = { id: string; email: string; role: OrgRole; expires_at: string; expired: boolean };

const btn = "rounded-full border border-border px-3 py-1.5 text-sm font-medium text-text hover:bg-bg-hover";

/** Organization admin: staff, roles, invites and deactivation. Read through the database's access rules. */
export default async function OrganizationPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string; link?: string; n?: string }> }) {
  const userId = await requireUserId();
  const m = await getMembership();
  if (!m) redirect("/organization/new");
  if (!m.active || m.role !== "admin") redirect("/settings#organization");
  const { error, saved, link: newTeamLink } = await searchParams;
  const [seats, referralSettings, memberRules] = await Promise.all([
    seatUsage(m.orgId),
    loadReferralSettings(m.orgId),
    // Read by the server (after the admin check above): Member data rules and how many private contacts Members already keep.
    queryOne<{ can_export: boolean; can_private: boolean; private_count: number }>(
      `select o.members_can_export as can_export, o.members_can_keep_private as can_private,
              (select count(*) from people p join memberships x on x.user_id = p.user_id and x.org_id = o.id and x.active and x.role = 'case_manager'
                where p.org_id is null and p.deleted_at is null)::int as private_count
         from organizations o where o.id = $1`,
      [m.orgId],
    ),
  ]);

  const [members, invites, info] = await asUser(userId, async (q) => [
    await q<Member>(
      `select m.user_id, m.role, m.active, u.name, u.email,
              (select count(*) from people p where p.user_id = m.user_id and p.org_id = m.org_id and p.deleted_at is null)::int as clients
         from memberships m join users u on u.id = m.user_id
        where m.org_id = $1
        order by m.active desc, coalesce(u.name, u.email)`,
      [m.orgId],
    ),
    await q<Invite>(
      `select id, email, role, expires_at, expires_at < now() as expired from invitations
        where org_id = $1 and accepted_at is null order by created_at desc`,
      [m.orgId],
    ),
    (await q<OrgInfo>(`select name, phone, email, website, address, about, extract(epoch from logo_updated_at)::bigint::text as logo_version, referral_code, referral_enabled, kind, join_token_hash is not null as team_link_on, join_domains from organizations where id = $1`, [m.orgId]))[0],
  ]);
  const active = members.filter((x) => x.active);
  const myDomain = emailDomain(members.find((x) => x.user_id === userId)?.email ?? "");
  const suggestedDomains = info?.join_domains?.join(", ") || (PUBLIC_EMAIL_DOMAINS.has(myDomain) ? "" : myDomain);

  return (
    <div className="max-w-xl space-y-8">
      <div className="space-y-1">
        <p className="eyebrow text-text-faint">Organization</p>
        <h1 className="page-title">{m.orgName}</h1>
        <p className="text-sm text-text-muted">
          {active.length} active {active.length === 1 ? "member" : "members"} ·{" "}
          <Link href="/organization/clients" className="text-accent hover:underline">
            bring in your clients
          </Link>
        </p>
      </div>
      <SeatSummary seats={seats} canManage />

      {error && ERRORS[error] && <p className="flag text-sm">{ERRORS[error]}</p>}
      {saved && SAVED[saved] && <p className="text-sm text-accent">{SAVED[saved]}</p>}

      <section id="info" className="scroll-mt-20 space-y-3">
        <h2 className="section-label">Organization info</h2>
        <div className="card flex flex-wrap items-center gap-4 p-4">
          <div className="flex h-16 w-32 items-center justify-center overflow-hidden rounded-xl border border-border bg-white">
            {info?.logo_version ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/org-logo?v=${info.logo_version}`} alt={`${m.orgName} logo`} className="max-h-14 max-w-28 object-contain" />
            ) : (
              <span className="text-xs text-text-muted">No logo</span>
            )}
          </div>
          <form action={uploadOrgLogo} className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              name="logo"
              accept="image/png,image/jpeg"
              required
              className="max-w-56 text-xs text-text-muted file:mr-2 file:rounded-full file:border file:border-border file:bg-transparent file:px-3 file:py-1 file:text-xs file:text-text"
            />
            <button type="submit" className={btn}>
              Upload logo
            </button>
          </form>
          {info?.logo_version && (
            <form action={removeOrgLogo}>
              <button type="submit" className="text-xs text-text-muted hover:text-danger">
                Remove
              </button>
            </form>
          )}
          <p className="w-full text-xs text-text-muted">PNG or JPG, up to 1 MB. Shown on your Team page and on {info?.kind === "business" ? "Insights" : "Impact"} report covers.</p>
        </div>
        <form key={JSON.stringify(info)} action={saveOrganizationInfo} className="card grid gap-3 p-4 sm:grid-cols-2">
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs text-text-muted">Name</span>
            <input name="name" defaultValue={info?.name ?? m.orgName} required maxLength={200} className="input" />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-text-muted">Phone</span>
            <input name="phone" type="tel" defaultValue={info?.phone ?? ""} maxLength={40} autoComplete="off" className="input" />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-text-muted">Email</span>
            <input name="email" type="email" defaultValue={info?.email ?? ""} maxLength={254} autoComplete="off" className="input" />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs text-text-muted">Website</span>
            <input name="website" defaultValue={info?.website ?? ""} maxLength={300} placeholder="hopehouse.org" className="input" />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs text-text-muted">Address</span>
            <textarea name="address" defaultValue={info?.address ?? ""} maxLength={500} rows={2} className="input" />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs text-text-muted">About (one or two sentences, shown on your PDF reports)</span>
            <textarea name="about" defaultValue={info?.about ?? ""} maxLength={1000} rows={2} placeholder="Hope House helps families in San Diego find and keep stable housing." className="input" />
          </label>
          <div className="flex items-center gap-3 sm:col-span-2">
            <button type="submit" className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-bg hover:bg-accent-dim">
              Save
            </button>
            {saved === "info" && <span className="text-sm text-accent">Saved.</span>}
          </div>
        </form>
      </section>

      <section id="staff" className="scroll-mt-20 space-y-3">
        <h2 className="section-label">Staff</h2>
        {active.length > 2 && (
          <BulkRoleChange
            people={active
              .filter((x) => x.user_id !== userId)
              .map((x) => ({ id: x.user_id, label: x.name ? `${x.name} (${x.email})` : x.email, role: x.role }))}
          />
        )}
        <ul className="card divide-y divide-border-subtle">
          {members.map((x) => (
            <li key={x.user_id} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text">
                    {x.name || x.email}
                    {x.user_id === userId && <span className="font-normal text-text-muted"> (you)</span>}
                  </p>
                  <p className="truncate text-xs text-text-muted">
                    {x.name ? `${x.email} · ` : ""}
                    {x.clients} {x.clients === 1 ? "client" : "clients"}
                  </p>
                </div>
                <span className={`tag shrink-0 ${x.active ? "tag-v" : "bg-bg-hover text-text-muted"}`}>
                  {x.active ? ROLE_LABELS[x.role] : "Deactivated"}
                </span>
              </div>

              {x.active ? (
                <div className="flex flex-wrap items-end gap-2">
                  <form action={changeRole} className="flex items-center gap-2">
                    <input type="hidden" name="user_id" value={x.user_id} />
                    <select name="role" defaultValue={x.role} aria-label="Role" className="input w-auto py-1 text-sm">
                      {ORG_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className={btn}>
                      Save role
                    </button>
                  </form>
                  {x.clients > 0 && active.length > 1 && (
                    <details className="w-full">
                      <summary className="cursor-pointer text-xs text-text-muted hover:text-text">Move all {x.clients} clients…</summary>
                      <form action={reassignAllClients} className="mt-2 flex flex-wrap items-end gap-2">
                        <input type="hidden" name="user_id" value={x.user_id} />
                        <label className="space-y-1">
                          <span className="block text-xs text-text-muted">To</span>
                          <select name="to_user_id" required className="input py-1 text-sm">
                            {active
                              .filter((o) => o.user_id !== x.user_id)
                              .map((o) => (
                                <option key={o.user_id} value={o.user_id}>
                                  {o.name || o.email}
                                </option>
                              ))}
                          </select>
                        </label>
                        <button type="submit" className={btn}>
                          Move clients
                        </button>
                        <p className="w-full text-xs text-text-muted">Notes, tasks and check-ins move with them. Personal records stay put.</p>
                      </form>
                    </details>
                  )}
                  {x.user_id !== userId && (
                    <details className="w-full">
                      <summary className="cursor-pointer text-xs text-text-muted hover:text-danger">Deactivate…</summary>
                      <form action={deactivateMember} className="mt-2 space-y-2">
                        <input type="hidden" name="user_id" value={x.user_id} />
                        <label className="block space-y-1">
                          <span className="text-xs text-text-muted">
                            Hand their {x.clients} {x.clients === 1 ? "client" : "clients"} (with notes, tasks and check-ins) to:
                          </span>
                          <select name="to_user_id" required className="input py-1 text-sm">
                            {active
                              .filter((o) => o.user_id !== x.user_id)
                              .map((o) => (
                                <option key={o.user_id} value={o.user_id}>
                                  {o.name || o.email}
                                </option>
                              ))}
                          </select>
                        </label>
                        <p className="text-xs text-text-muted">
                          They lose access to {m.orgName} right away. Their personal tasks and notes stay theirs.
                        </p>
                        <button type="submit" className="rounded-full border border-danger px-3 py-1.5 text-sm font-medium text-danger hover:bg-bg-hover">
                          Deactivate
                        </button>
                      </form>
                    </details>
                  )}
                </div>
              ) : (
                <form action={reactivateMember}>
                  <input type="hidden" name="user_id" value={x.user_id} />
                  <button type="submit" className={btn}>
                    Reactivate
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section id="referrals" className="scroll-mt-20 space-y-3">
        <h2 className="section-label">Referral link</h2>
        <div className="card space-y-3 p-4">
          <p className="text-sm text-text-muted">
            Send this link to other departments and partners. They fill in the client&apos;s details, the services they
            need, notes and an appointment time, plus their own name, department and email, with no account needed. Referrals land in{" "}
            <Link href="/referrals" className="text-accent hover:underline">
              Referrals
            </Link>{" "}
            and admins get a notification.
          </p>
          {info?.referral_enabled && info.referral_code ? (
            <>
              <CopyText value={`${appUrl()}/refer/${info.referral_code}`} />
              <div className="flex flex-wrap gap-2">
                <form action={setReferralLink}>
                  <input type="hidden" name="enabled" value="0" />
                  <button type="submit" className={btn}>
                    Turn off
                  </button>
                </form>
                <form action={newReferralLink}>
                  <button type="submit" className={btn}>
                    Make a new link
                  </button>
                </form>
              </div>
              <p className="text-xs text-text-faint">Making a new link stops the old one from working.</p>
            </>
          ) : (
            <form action={setReferralLink}>
              <input type="hidden" name="enabled" value="1" />
              <button type="submit" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg hover:bg-accent-dim">
                Turn on referral link
              </button>
            </form>
          )}
        </div>
        <ReferralSettingsCard settings={referralSettings} />
      </section>

      <section className="space-y-3">
        <h2 className="section-label">Invites</h2>
        {seats.purchased !== null && (
          <p className="text-sm text-text-muted">
            {Math.max(0, seats.purchased - seats.active - seats.pending) === 0
              ? "No seats left: add seats in Billing before inviting more people."
              : `${seats.purchased - seats.active - seats.pending} ${seats.purchased - seats.active - seats.pending === 1 ? "seat" : "seats"} left to invite people into.`}
          </p>
        )}
        <InviteForm orgName={m.orgName} />
        <BulkInviteCard />
        {invites.length > 0 && (
          <ul className="card divide-y divide-border-subtle">
            {invites.length > 50 && (
              <li className="p-4 text-xs text-text-muted">
                {invites.length} invites waiting. Showing the newest 50.
              </li>
            )}
            {invites.slice(0, 50).map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm text-text">{i.email}</p>
                  <p className="text-xs text-text-muted">
                    {ROLE_LABELS[i.role]} · {i.expired ? "expired (copy a new link)" : "waiting. They'll also see it in the app when they sign in."}
                  </p>
                </div>
                <div className="flex shrink-0 items-start gap-3">
                  <CopyInviteLink inviteId={i.id} />
                  <form action={revokeInvite}>
                    <input type="hidden" name="id" value={i.id} />
                    <button type="submit" className="text-xs text-text-muted hover:text-danger">
                      Cancel
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="team-link" className="scroll-mt-20 space-y-3">
        <h2 className="section-label">Team join link</h2>
        <div className="card space-y-3 p-4">
          <p className="text-sm text-text-muted">
            For big teams: one link you post in an all-staff email or chat. Anyone with an email at your domain can join as a Member, until
            your seats are full. Promote managers afterward under Staff.
          </p>
          {info?.team_link_on && newTeamLink && saved === "team-link" ? (
            <CopyText value={`${appUrl()}/join/team/${newTeamLink}`} />
          ) : info?.team_link_on ? (
            <p className="text-sm text-text">
              <span className="tag tag-v mr-2">On</span>
              For {(info.join_domains ?? []).map((d) => `@${d}`).join(", ")}. The link is only shown when it&apos;s made; make a new one to copy
              it again (the old one stops working).
            </p>
          ) : (
            <p className="text-sm text-text">
              <span className="tag tag-u mr-2">Off</span>
              Nobody can join without an invite.
            </p>
          )}
          <form action={saveTeamLink} className="space-y-2">
            <label className="block space-y-1">
              <span className="text-xs text-text-muted">Email domains allowed (work domains only, separated by commas)</span>
              <input name="domains" defaultValue={suggestedDomains} placeholder="agency.org" className="input" spellCheck={false} />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="submit" name="action" value={info?.team_link_on ? "new" : "on"} className={btn}>
                {info?.team_link_on ? "Make a new link" : "Turn on the team link"}
              </button>
              {info?.team_link_on && (
                <button type="submit" name="action" value="off" formNoValidate className="text-sm text-text-muted hover:text-danger">
                  Turn off
                </button>
              )}
            </div>
          </form>
        </div>
      </section>

      <section id="member-data" className="scroll-mt-20 space-y-3">
        <h2 className="section-label">What Members can do with data</h2>
        <form action={setMemberDataRules} className="card space-y-4 p-4">
          <p className="text-sm text-text-muted">
            Members&apos; logins belong to your organization. Both are off unless you turn them on. Admins and Managers aren&apos;t affected.
          </p>
          <label className="flex items-start gap-3 text-sm text-text">
            <input type="checkbox" name="members_can_export" defaultChecked={memberRules?.can_export ?? false} className="mt-1" />
            <span>
              Members can download data
              <span className="block text-xs text-text-muted">Backups and spreadsheets of the clients, notes and visits assigned to them.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm text-text">
            <input type="checkbox" name="members_can_keep_private" defaultChecked={memberRules?.can_private ?? false} className="mt-1" />
            <span>
              Members can keep private contacts
              <span className="block text-xs text-text-muted">
                Contacts your organization can&apos;t see. When off, every client a Member adds belongs to the organization, and Members can&apos;t make a
                client private.
              </span>
            </span>
          </label>
          {(memberRules?.private_count ?? 0) > 0 && (
            <p className="text-xs text-text-muted">
              Members already keep {memberRules!.private_count} private {memberRules!.private_count === 1 ? "contact" : "contacts"} from before. They stay
              private; turning this off only stops new ones.
            </p>
          )}
          <button type="submit" className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-bg hover:bg-accent-dim">
            Save
          </button>
        </form>
      </section>

      <section id="type" className="scroll-mt-20 space-y-3">
        <h2 className="section-label">Organization type</h2>
        {saved === "kind" && <p className="text-sm text-accent">{SAVED.kind}</p>}
        <form key={info?.kind} action={setOrgKind} className="space-y-3">
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="sr-only">Organization type</legend>
            {ORG_KINDS.map((k) => {
              const current = (info?.kind ?? "nonprofit") === k.value;
              return (
                <label
                  key={k.value}
                  className="card flex cursor-pointer items-start gap-3 p-4 transition-colors hover:bg-bg-hover has-[:checked]:border-accent has-[:checked]:ring-1 has-[:checked]:ring-accent"
                >
                  <input type="radio" name="kind" value={k.value} defaultChecked={current} required className="mt-1 accent-[var(--accent)]" />
                  <OrgKindText {...k} current={current} />
                </label>
              );
            })}
          </fieldset>
          <p className="text-xs text-text-muted">{ORG_KINDS_SAME}</p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-bg hover:bg-accent-dim">
              Save type
            </button>
            <p className="text-xs text-text-muted">Changes the words and reports for everyone in your organization.</p>
          </div>
        </form>
      </section>
    </div>
  );
}
