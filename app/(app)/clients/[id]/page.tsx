import Link from "next/link";
import { notFound } from "next/navigation";
import { getClient } from "@/lib/actions/clients";
import { getClientTimeline } from "@/lib/actions/activity";
import { listTasksForClient } from "@/lib/actions/tasks";
import { listListsForClient } from "@/lib/actions/lists";
import { ClientTimeline } from "@/components/clients/ClientTimeline";
import { TaskRow } from "@/components/tasks/TaskRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import type { Activity } from "@/lib/types";

export default async function ClientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  const [activity, tasks, lists] = await Promise.all([
    getClientTimeline(client.id),
    listTasksForClient(client.id),
    listListsForClient(client.id),
  ]);

  const openTasks = tasks.filter((t) => !t.completed);

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="font-mono text-lg uppercase tracking-wide text-text">
            {client.display_name}
          </h1>
          {client.needs_followup && <Badge>follow up</Badge>}
        </div>
      </div>

      <Section title="Current">
        <p className="text-sm text-text">{client.current_status ?? "—"}</p>
      </Section>

      <Section title="Next">
        <p className="text-sm text-accent">{client.next_action ?? "—"}</p>
      </Section>

      <Section title="Summary">
        <p className="text-sm text-text-muted">{client.summary ?? "No summary yet."}</p>
      </Section>

      <Section title="Timeline">
        <ClientTimeline activity={activity as Activity[]} />
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
