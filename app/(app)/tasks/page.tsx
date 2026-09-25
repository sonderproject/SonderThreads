import { listTasks } from "@/lib/actions/tasks";
import { listPeople } from "@/lib/actions/people";
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
  const [tasks, people] = await Promise.all([listTasks(), listPeople()]);
  const peopleById = new Map(people.map((c) => [c.id, c]));

  const open = tasks.filter((t) => !t.completed);
  const completed = tasks.filter((t) => t.completed);

  const today = open.filter((t) => t.due_at && (isToday(t.due_at) || isPast(t.due_at)));
  const upcoming = open.filter((t) => t.due_at && !isToday(t.due_at) && !isPast(t.due_at));
  const noDate = open.filter((t) => !t.due_at);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-mono text-xs uppercase tracking-wide text-text-faint">Tasks</h1>
        <NewTaskButton people={people.map((c) => ({ id: c.id, display_name: c.display_name }))} />
      </div>

      <TaskSection title="Today" tasks={today} peopleById={peopleById} empty="Nothing due today." />
      <TaskSection title="Upcoming" tasks={upcoming} peopleById={peopleById} empty="Nothing upcoming." />
      <TaskSection title="No Date" tasks={noDate} peopleById={peopleById} empty="Nothing here." />
      <TaskSection title="Completed" tasks={completed} peopleById={peopleById} empty="Nothing completed yet." />
    </div>
  );
}

function TaskSection({
  title,
  tasks,
  peopleById,
  empty,
}: {
  title: string;
  tasks: Task[];
  peopleById: Map<string, { display_name: string }>;
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
              personName={task.person_id ? peopleById.get(task.person_id)?.display_name : null}
            />
          ))}
        </div>
      )}
    </section>
  );
}
