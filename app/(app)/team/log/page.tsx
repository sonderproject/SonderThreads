import Link from "next/link";
import { notFound } from "next/navigation";
import { asUser } from "@/lib/db/as-user";
import { getTimeZone } from "@/lib/timezone";
import { requireTeamViewer } from "@/lib/team";

type Entry = {
  id: string;
  at: string;
  action: string;
  table_name: string;
  fields: string[] | null;
  person_id: string | null;
  actor: string | null;
  client: string | null;
};

const WHAT: Record<string, string> = {
  people: "client record",
  notes: "note",
  tasks: "task",
  check_ins: "check-in",
  client_comments: "comment",
};
const VERB: Record<string, string> = {
  create: "added a",
  update: "changed a",
  delete: "deleted a",
  restore: "restored a",
  reassign: "reassigned a",
  view: "viewed the",
};

/** Admins: who did what to the organization's client records, newest first. */
export default async function AuditLogPage() {
  const viewer = await requireTeamViewer();
  if (viewer.role !== "admin") notFound();
  const tz = await getTimeZone();
  const entries = await asUser(viewer.userId, (q) =>
    q<Entry>(
      `select a.id, a.at, a.action, a.table_name, a.fields, a.person_id,
              coalesce(u.name, u.email) as actor, p.display_name as client
         from audit_log a
         left join users u on u.id = a.actor_id
         left join people p on p.id = a.person_id
        where a.org_id = $1
        order by a.at desc
        limit 300`,
      [viewer.orgId],
    ),
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/team" className="text-sm text-accent hover:underline">
          ← Team
        </Link>
        <h1 className="page-title">Activity log</h1>
        <p className="text-sm text-text-muted">
          Who added, changed, deleted, reassigned or viewed {viewer.orgName}&apos;s client records. The latest 300 entries.
          Personal records are never logged.
        </p>
      </div>
      {entries.length === 0 ? (
        <div className="card p-4 text-sm text-text-muted">Nothing yet.</div>
      ) : (
        <ul className="card divide-y divide-border-subtle">
          {entries.map((e) => (
            <li key={e.id} className="space-y-0.5 p-3 text-sm">
              <p className="text-text">
                <span className="font-semibold">{e.actor ?? "Former staff"}</span> {VERB[e.action] ?? e.action}{" "}
                {WHAT[e.table_name] ?? e.table_name}
                {e.client && (
                  <>
                    {" "}for{" "}
                    {e.person_id ? (
                      <Link href={`/team/client/${e.person_id}`} className="text-accent hover:underline">
                        {e.client}
                      </Link>
                    ) : (
                      e.client
                    )}
                  </>
                )}
                {e.action === "update" && e.fields?.includes("personal") ? (
                  <span className="text-text-muted"> (changed who can see it)</span>
                ) : e.action === "update" && e.fields?.length ? (
                  <span className="text-text-muted"> ({e.fields.join(", ").replaceAll("_", " ")})</span>
                ) : null}
              </p>
              <p className="text-xs text-text-faint tabular-nums">
                {new Date(e.at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: tz })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
