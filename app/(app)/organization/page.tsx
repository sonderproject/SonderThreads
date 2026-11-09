import Link from "next/link";
import { redirect } from "next/navigation";
import { asUser } from "@/lib/db/as-user";
import { requireUserId } from "@/lib/current-user";
import { getMembership, ORG_ROLES, ROLE_LABELS, type OrgRole } from "@/lib/org";
import { changeRole, deactivateMember, reactivateMember, renameOrganization, revokeInvite } from "@/lib/actions/org";
import { InviteForm } from "@/components/org/InviteForm";

const ERRORS: Record<string, string> = {
  "last-admin": "An organization needs at least one active admin. Make someone else an admin first.",
  self: "You can't deactivate yourself.",
  reassign: "Choose an active staff member to take over their clients.",
  role: "Choose a role.",
  name: "Enter a name.",
};
const SAVED: Record<string, string> = {
  role: "Role updated.",
  deactivated: "Deactivated. Their clients were handed over.",
  reactivated: "Reactivated.",
  name: "Name updated.",
};

type Member = { user_id: string; role: OrgRole; active: boolean; name: string | null; email: string; clients: number };
type Invite = { id: string; email: string; role: OrgRole; expires_at: string; expired: boolean };

const btn = "rounded border border-border px-3 py-1.5 text-sm font-medium text-text hover:bg-bg-hover";

/** Organization admin: staff, roles, invites and deactivation. Read through the database's access rules. */
export default async function OrganizationPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const userId = await requireUserId();
  const m = await getMembership();
  if (!m) redirect("/organization/new");
  if (!m.active || m.role !== "admin") redirect("/settings#organization");
  const { error, saved } = await searchParams;

  const [members, invites] = await asUser(userId, async (q) => [
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
  ]);
  const active = members.filter((x) => x.active);

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

      {error && ERRORS[error] && <p className="flag text-sm">{ERRORS[error]}</p>}
      {saved && SAVED[saved] && <p className="text-sm text-accent">{SAVED[saved]}</p>}

      <section className="space-y-3">
        <h2 className="section-label">Staff</h2>
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
                        <button type="submit" className="rounded border border-danger px-3 py-1.5 text-sm font-medium text-danger hover:bg-bg-hover">
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

      <section className="space-y-3">
        <h2 className="section-label">Invites</h2>
        <InviteForm orgName={m.orgName} />
        {invites.length > 0 && (
          <ul className="card divide-y divide-border-subtle">
            {invites.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm text-text">{i.email}</p>
                  <p className="text-xs text-text-muted">
                    {ROLE_LABELS[i.role]} · {i.expired ? "expired" : "waiting to be accepted"}
                  </p>
                </div>
                <form action={revokeInvite}>
                  <input type="hidden" name="id" value={i.id} />
                  <button type="submit" className="text-xs text-text-muted hover:text-danger">
                    Cancel
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="section-label">Name</h2>
        <form action={renameOrganization} className="card flex gap-2 p-4">
          <input name="name" defaultValue={m.orgName} required maxLength={200} aria-label="Organization name" className="input" />
          <button type="submit" className={btn}>
            Save
          </button>
        </form>
      </section>
    </div>
  );
}
