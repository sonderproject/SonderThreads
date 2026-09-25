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

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="font-mono text-lg uppercase tracking-wide text-text">
            {person.display_name}
          </h1>
          {person.needs_followup && <Badge>follow up</Badge>}
          {isStale(person) && (
            <span title={`No activity in ${STALE_DAYS}+ days`}>
              <Badge>stale</Badge>
            </span>
          )}
        </div>
      </div>

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 font-mono text-xs uppercase tracking-wide text-text-faint">{title}</h2>
      {children}
    </section>
  );
}
