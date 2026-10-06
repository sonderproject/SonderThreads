import { listTasks } from "@/lib/actions/tasks";
import { listPeople } from "@/lib/actions/people";
import { TasksBrowser } from "@/components/tasks/TasksBrowser";
import { NewTaskButton } from "@/components/tasks/NewTaskButton";

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

  const open = tasks.filter((t) => !t.completed);
  const completed = tasks.filter((t) => t.completed);

  const today = open.filter((t) => t.due_at && (isToday(t.due_at) || isPast(t.due_at)));
  const upcoming = open.filter((t) => t.due_at && !isToday(t.due_at) && !isPast(t.due_at));
  const noDate = open.filter((t) => !t.due_at);

  return (
    <TasksBrowser
      sections={[
        { title: "Today", tasks: today, empty: "Nothing due today." },
        { title: "Upcoming", tasks: upcoming, empty: "Nothing upcoming." },
        { title: "No Date", tasks: noDate, empty: "Nothing here." },
        { title: "Completed", tasks: completed, empty: "Nothing completed yet." },
      ]}
      personNames={Object.fromEntries(people.map((c) => [c.id, c.display_name]))}
      newButton={<NewTaskButton people={people.map((c) => ({ id: c.id, display_name: c.display_name }))} />}
    />
  );
}
