import Link from "next/link";
import { notFound } from "next/navigation";
import { getPerson } from "@/lib/actions/people";
import { getPersonTimeline } from "@/lib/actions/activity";
import { listTasksForPerson } from "@/lib/actions/tasks";
import { listListsForPerson } from "@/lib/actions/lists";
import { PersonTimeline } from "@/components/people/PersonTimeline";
import { EditableField } from "@/components/people/EditableField";
import { TaskRow } from "@/components/tasks/TaskRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { isStale, STALE_DAYS } from "@/lib/stale";
import type { Activity } from "@/lib/types";

/** node-postgres returns `date` columns as a local-midnight Date; the date input wants YYYY-MM-DD. */
function toDateString(value: string | Date | null): string | null {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function formatBirthday(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

export default async function PersonProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const person = await getPerson(id);
  if (!person) notFound();

  const [activity, tasks, lists] = await Promise.all([
    getPersonTimeline(person.id),
    listTasksForPerson(person.id),
    listListsForPerson(person.id),
  ]);

  const openTasks = tasks.filter((t) => !t.completed);
  const birthday = toDateString(person.birthday as string | Date | null);

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2">
          <h1>
            <EditableField
              personId={person.id}
              field="display_name"
              value={person.display_name}
              placeholder="Name"
              textClassName="font-mono text-lg uppercase tracking-wide text-text"
              required
            />
          </h1>
          {person.needs_followup && <Badge>follow up</Badge>}
          {isStale(person) && (
            <span title={`No activity in ${STALE_DAYS}+ days`}>
              <Badge>stale</Badge>
            </span>
          )}
        </div>
      </div>

      <Section title="Details">
        <div className="grid gap-2 sm:grid-cols-3">
          <Detail label="Birthday">
            <EditableField
              personId={person.id}
              field="birthday"
              value={birthday}
              placeholder="Add birthday..."
              textClassName="text-sm text-text"
              inputType="date"
              displayValue={birthday ? formatBirthday(birthday) : null}
            />
          </Detail>
          <Detail label="Phone">
            <EditableField
              personId={person.id}
              field="phone"
              value={person.phone}
              placeholder="Add phone..."
              textClassName="text-sm text-text"
              inputType="tel"
            />
          </Detail>
          <Detail label="Email">
            <EditableField
              personId={person.id}
              field="email"
              value={person.email}
              placeholder="Add email..."
              textClassName="break-all text-sm text-text"
              inputType="email"
            />
          </Detail>
        </div>
      </Section>

      <Section title="Current">
        <EditableField
          personId={person.id}
          field="current_status"
          value={person.current_status}
          placeholder="Click to add current status..."
          textClassName="text-sm text-text"
        />
      </Section>

      <Section title="Next">
        <EditableField
          personId={person.id}
          field="next_action"
          value={person.next_action}
          placeholder="Click to add next action..."
          textClassName="text-sm text-accent"
        />
      </Section>

      <Section title="Summary">
        <p className="text-sm text-text-muted">{person.summary ?? "No summary yet."}</p>
      </Section>

      <Section title="Timeline">
        <PersonTimeline activity={activity as Activity[]} />
      </Section>

      <Section title="Tasks">
        {openTasks.length === 0 ? (
          <EmptyState message="No open tasks." />
        ) : (
          <div className="divide-y divide-border-subtle rounded border border-border">
            {openTasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Lists">
        {lists.length === 0 ? (
          <EmptyState message="Not on any lists." />
        ) : (
          <div className="flex flex-wrap gap-2">
            {lists.map((list) => (
              <Link
                key={list.id}
                href={`/lists/${list.id}`}
                className="rounded border border-border px-2.5 py-1 text-sm text-text hover:border-accent hover:text-accent"
              >
                {list.name}
              </Link>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-border px-3 py-2">
      <p className="mb-0.5 font-mono text-[11px] uppercase text-text-faint">{label}</p>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 font-mono text-xs uppercase tracking-wide text-text-faint">{title}</h2>
      {children}
    </section>
  );
}
