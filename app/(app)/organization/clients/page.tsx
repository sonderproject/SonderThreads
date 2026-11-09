import Link from "next/link";
import { redirect } from "next/navigation";
import { query } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { getMembership } from "@/lib/org";
import { moveClientsToOrg } from "@/lib/actions/org";
import { ClientPicker } from "@/components/org/ClientPicker";

/** After creating or joining: choose which existing clients belong to the organization. */
export default async function OrgClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; joined?: string; moved?: string }>;
}) {
  const userId = await requireUserId();
  const m = await getMembership();
  if (!m?.active) redirect("/settings");
  const { new: created, joined, moved } = await searchParams;
  const [personal, inOrg] = await Promise.all([
    query<{ id: string; display_name: string }>(
      `select id, display_name from people where user_id = $1 and org_id is null and deleted_at is null order by display_name`,
      [userId],
    ),
    query<{ n: number }>(`select count(*)::int n from people where user_id = $1 and org_id is not null and deleted_at is null`, [userId]),
  ]);

  return (
    <div className="max-w-md space-y-6">
      <div className="space-y-1">
        {(created || joined) && (
          <p className="text-sm text-accent">{created ? `${m.orgName} is set up.` : `You joined ${m.orgName}.`}</p>
        )}
        <h1 className="page-title">Bring clients into {m.orgName}</h1>
        <p className="text-sm text-text-muted">
          Clients you move here, with their notes, tasks and check-ins, belong to {m.orgName}: its supervisors and admins
          can view them. Anyone you don&apos;t move stays private to you. New clients you add from now on belong to{" "}
          {m.orgName} automatically.
        </p>
        <p className="text-xs text-text-faint">
          Your tasks, notes and lists that aren&apos;t about a client always stay private.
        </p>
      </div>

      {moved !== undefined && <p className="text-sm text-accent">Moved {moved} {moved === "1" ? "client" : "clients"}.</p>}
      <p className="text-sm text-text-muted">
        {inOrg[0]?.n ?? 0} of your clients belong to {m.orgName}.
      </p>

      {personal.length === 0 ? (
        <div className="card p-4 text-sm text-text-muted">You have no private clients left to move.</div>
      ) : (
        <form action={moveClientsToOrg} className="card space-y-3 p-4">
          <ClientPicker people={personal} />
          <button type="submit" className="rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-bg hover:bg-accent-dim">
            Move selected to {m.orgName}
          </button>
        </form>
      )}

      <Link href={m.role === "admin" ? "/organization" : "/"} className="inline-block text-sm text-accent hover:underline">
        {m.role === "admin" ? "Next: invite your staff →" : "Done →"}
      </Link>
    </div>
  );
}
