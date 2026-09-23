import { listTasks } from "@/lib/actions/tasks";
import { listClients } from "@/lib/actions/clients";
import { TaskRow } from "@/components/tasks/TaskRow";
import { NewTaskButton } from "@/components/tasks/NewTaskButton";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Task } from "@/lib/types";

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isPast(iso: string): boolean {
  return new Date(iso).getTime() < new Date().setHours(0, 0, 0, 0);
}

export default async function TasksPage() {
  const [tasks, clients] = await Promise.all([listTasks(), listClients()]);
  const clientsById = new Map(clients.map((c) => [c.id, c]));

  const open = tasks.filter((t) => !t.completed);
  const completed = tasks.filter((t) => t.completed);

  const today = open.filter((t) => t.due_at && (isToday(t.due_at) || isPast(t.due_at)));
  const upcoming = open.filter((t) => t.due_at && !isToday(t.due_at) && !isPast(t.due_at));
  const noDate = open.filter((t) => !t.due_at);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-mono text-xs uppercase tracking-wide text-text-faint">Tasks</h1>
        <NewTaskButton clients={clients.map((c) => ({ id: c.id, display_name: c.display_name }))} />
      </div>

      <TaskSection title="Today" tasks={today} clientsById={clientsById} empty="Nothing due today." />
      <TaskSection title="Upcoming" tasks={upcoming} clientsById={clientsById} empty="Nothing upcoming." />
      <TaskSection title="No Date" tasks={noDate} clientsById={clientsById} empty="Nothing here." />
      <TaskSection title="Completed" tasks={completed} clientsById={clientsById} empty="Nothing completed yet." />
    </div>
  );
}

function TaskSection({
  title,
  tasks,
  clientsById,
  empty,
}: {
  title: string;
  tasks: Task[];
  clientsById: Map<string, { display_name: string }>;
  empty: string;
}) {
  return (
    <section>
      <h2 className="mb-2 font-mono text-xs uppercase tracking-wide text-text-faint">{title}</h2>
      {tasks.length === 0 ? (
        <EmptyState message={empty} />
      ) : (
        <div className="divide-y divide-border-subtle rounded border border-border">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              clientName={task.client_id ? clientsById.get(task.client_id)?.display_name : null}
            />
          ))}
        </div>
      )}
    </section>
  );
}
