import Link from "next/link";
import { notFound } from "next/navigation";
import { asUser } from "@/lib/db/as-user";
import { isUuid } from "@/lib/ids";
import { getTimeZone } from "@/lib/timezone";
import { logClientView, requireTeamViewer, shortDate } from "@/lib/team";
import { reassignClient } from "@/lib/actions/org";
import { ClientComments, type ClientComment } from "@/components/org/ClientComments";

type Person = {
  id: string;
  display_name: string;
  phone: string | null;
  email: string | null;
  birthday: string | null;
  gender: string | null;
  ethnicity: string | null;
  income_level: string | null;
  current_status: string | null;
  next_action: string | null;
  summary: string | null;
  needs_followup: boolean;
  created_at: string;
  user_id: string;
  owner_name: string | null;
  owner_email: string;
};
type Note = { id: string; content: string; created_at: string };
type Task = { id: string; title: string; due_at: string | null; completed: boolean; completed_at: string | null };
type CheckIn = { id: string; checked_in_at: string; reason: string | null };
type Activity = { id: string; description: string; created_at: string };

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 text-sm">
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-text">{value}</dd>
    </div>
  );
}

/** A client's full record for a supervisor or admin. Read-only; access checked by the database. */
export default async function TeamClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const { saved, error } = await searchParams;
  if (!isUuid(id)) notFound();
  const viewer = await requireTeamViewer();
  const tz = await getTimeZone();

  const data = await asUser(viewer.userId, async (q) => {
    const [person] = await q<Person>(
      `select p.id, p.display_name, p.phone, p.email, to_char(p.birthday, 'YYYY-MM-DD') as birthday, p.gender, p.ethnicity,
              p.income_level, p.current_status, p.next_action, p.summary, p.needs_followup, p.created_at, p.user_id,
              u.name as owner_name, u.email as owner_email
         from people p join users u on u.id = p.user_id
        where p.id = $1 and p.org_id = $2 and p.deleted_at is null`,
      [id, viewer.orgId],
    );
    if (!person) return null;
    const [notes, tasks, checkIns, activity, staff, comments] = await Promise.all([
      q<Note>(`select id, content, created_at from notes where person_id = $1 and deleted_at is null order by created_at desc`, [id]),
      q<Task>(
        `select id, title, due_at, completed, completed_at from tasks where person_id = $1 and deleted_at is null
          order by completed, due_at nulls last, created_at desc`,
        [id],
      ),
      q<CheckIn>(`select id, checked_in_at, reason from check_ins where person_id = $1 and deleted_at is null order by checked_in_at desc`, [id]),
      q<Activity>(`select id, description, created_at from activity where person_id = $1 order by created_at desc limit 30`, [id]),
      q<{ user_id: string; label: string }>(
        `select m.user_id, coalesce(u.name, u.email) as label from memberships m join users u on u.id = m.user_id
          where m.org_id = $1 and m.active order by 2`,
        [viewer.orgId],
      ),
      q<ClientComment>(
        `select c.id, c.body, c.created_at, coalesce(u.name, u.email) as author
           from client_comments c left join users u on u.id = c.author_id
          where c.person_id = $1 order by c.created_at desc`,
        [id],
      ),
    ]);
    return { person, notes, tasks, checkIns, activity, staff, comments };
  });
  if (!data) notFound();
  await logClientView(viewer.orgId, viewer.userId, id);
  const { person, notes, tasks, checkIns, activity, staff, comments } = data;
  const others = staff.filter((s) => s.user_id !== person.user_id);
  const open = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);
  const now = Date.now();

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <Link href={`/team/${person.user_id}`} className="text-sm text-accent hover:underline">
          ← {person.owner_name || person.owner_email}&apos;s caseload
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="page-title">{person.display_name}</h1>
          {person.needs_followup && <span className="tag tag-e">Follow up</span>}
          <span className="tag bg-bg-hover text-text-muted">Read-only</span>
        </div>
        <p className="text-sm text-text-muted">
          Case manager: {person.owner_name || person.owner_email} · client since {shortDate(person.created_at, tz)}
        </p>
      </div>

      {saved === "reassigned" && <p className="text-sm text-accent">Reassigned. The new case manager was notified.</p>}
      {error === "reassign" && <p className="flag text-sm">Choose an active staff member other than the current one.</p>}

      {others.length > 0 && (
        <form action={reassignClient} className="card flex flex-wrap items-end gap-2 p-4">
          <input type="hidden" name="person_id" value={person.id} />
          <label className="min-w-0 flex-1 space-y-1">
            <span className="text-xs text-text-muted">Reassign to</span>
            <select name="to_user_id" required className="input">
              {others.map((s) => (
                <option key={s.user_id} value={s.user_id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded-full border border-border px-3 py-1.5 text-sm font-medium text-text hover:bg-bg-hover">
            Reassign
          </button>
          <p className="w-full text-xs text-text-muted">Their notes, tasks and check-ins move with them.</p>
        </form>
      )}

      <ClientComments
        personId={person.id}
        comments={comments}
        canComment
        formatDate={(iso) => shortDate(iso, tz)}
        error={error === "comment"}
      />

      <section className="space-y-3">
        <h2 className="section-label">Details</h2>
        <dl className="card space-y-2 p-4">
          <Field label="Phone" value={person.phone} />
          <Field label="Email" value={person.email} />
          <Field label="Date of birth" value={person.birthday} />
          <Field label="Gender" value={person.gender} />
          <Field label="Ethnicity" value={person.ethnicity} />
          <Field label="Income level" value={person.income_level} />
          {person.summary && <p className="border-t border-border-subtle pt-2 text-sm text-text">{person.summary}</p>}
        </dl>
      </section>

      <section className="space-y-3">
        <h2 className="section-label">Open tasks ({open.length})</h2>
        {open.length === 0 ? (
          <p className="text-sm text-text-muted">No open tasks.</p>
        ) : (
          <ul className="card divide-y divide-border-subtle">
            {open.map((t) => {
              const overdue = t.due_at && new Date(t.due_at).getTime() < now;
              return (
                <li key={t.id} className={`flex items-center justify-between gap-3 p-3 text-sm ${overdue ? "flag-urgent" : ""}`}>
                  <span className="text-text">{t.title}</span>
                  {t.due_at && (
                    <span className={`shrink-0 text-xs ${overdue ? "text-urgent" : "text-text-muted"}`}>
                      {overdue ? "Overdue · " : ""}
                      {shortDate(t.due_at, tz)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="section-label">Notes ({notes.length})</h2>
        {notes.length === 0 ? (
          <p className="text-sm text-text-muted">No notes.</p>
        ) : (
          <ul className="space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="card space-y-1 p-3">
                <p className="whitespace-pre-wrap text-sm text-text">{n.content}</p>
                <p className="text-xs text-text-faint">{shortDate(n.created_at, tz)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="section-label">Check-ins ({checkIns.length})</h2>
        {checkIns.length === 0 ? (
          <p className="text-sm text-text-muted">No check-ins.</p>
        ) : (
          <ul className="card divide-y divide-border-subtle">
            {checkIns.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <span className="text-text">{c.reason || "Check-in"}</span>
                <span className="shrink-0 text-xs text-text-muted">{shortDate(c.checked_in_at, tz)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {done.length > 0 && (
        <section className="space-y-3">
          <h2 className="section-label">Completed tasks ({done.length})</h2>
          <ul className="card divide-y divide-border-subtle">
            {done.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <span className="text-text-muted line-through">{t.title}</span>
                {t.completed_at && <span className="shrink-0 text-xs text-text-faint">{shortDate(t.completed_at, tz)}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {activity.length > 0 && (
        <section className="space-y-3">
          <h2 className="section-label">History</h2>
          <ul className="card divide-y divide-border-subtle">
            {activity.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <span className="text-text">{a.description}</span>
                <span className="shrink-0 text-xs text-text-faint">{shortDate(a.created_at, tz)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
