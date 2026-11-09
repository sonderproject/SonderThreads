import Link from "next/link";
import { notFound } from "next/navigation";
import { asUser } from "@/lib/db/as-user";
import { isUuid } from "@/lib/ids";
import { getTimeZone } from "@/lib/timezone";
import { requireTeamViewer, shortDate } from "@/lib/team";

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
export default async function TeamClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
    const [notes, tasks, checkIns, activity] = await Promise.all([
      q<Note>(`select id, content, created_at from notes where person_id = $1 and deleted_at is null order by created_at desc`, [id]),
      q<Task>(
        `select id, title, due_at, completed, completed_at from tasks where person_id = $1 and deleted_at is null
          order by completed, due_at nulls last, created_at desc`,
        [id],
      ),
      q<CheckIn>(`select id, checked_in_at, reason from check_ins where person_id = $1 and deleted_at is null order by checked_in_at desc`, [id]),
      q<Activity>(`select id, description, created_at from activity where person_id = $1 order by created_at desc limit 30`, [id]),
    ]);
    return { person, notes, tasks, checkIns, activity };
  });
  if (!data) notFound();
  const { person, notes, tasks, checkIns, activity } = data;
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

      <section className="space-y-3">
        <h2 className="eyebrow text-text-faint">Details</h2>
        <dl className="card space-y-2 p-4">
          <Field label="Current status" value={person.current_status} />
          <Field label="Next step" value={person.next_action} />
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
        <h2 className="eyebrow text-text-faint">Open tasks ({open.length})</h2>
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
        <h2 className="eyebrow text-text-faint">Notes ({notes.length})</h2>
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
        <h2 className="eyebrow text-text-faint">Check-ins ({checkIns.length})</h2>
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
          <h2 className="eyebrow text-text-faint">Completed tasks ({done.length})</h2>
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
          <h2 className="eyebrow text-text-faint">History</h2>
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
