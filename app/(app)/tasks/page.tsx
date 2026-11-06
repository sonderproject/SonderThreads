import { listTasks } from "@/lib/actions/tasks";
import { listPeople } from "@/lib/actions/people";
import { TasksBrowser } from "@/components/tasks/TasksBrowser";
import { NewTaskButton } from "@/components/tasks/NewTaskButton";
import { getTimeZone } from "@/lib/timezone";
import { dayKey } from "@/lib/tz";

export default async function TasksPage() {
  const [tasks, people, timeZone] = await Promise.all([listTasks(), listPeople(), getTimeZone()]);
  // Compare calendar days in the viewer's zone (the server runs in UTC).
  const todayKey = dayKey(new Date(), timeZone);

  const open = tasks.filter((t) => !t.completed);
  const completed = tasks.filter((t) => t.completed);

  const today = open.filter((t) => t.due_at && dayKey(t.due_at, timeZone) <= todayKey);
  const upcoming = open.filter((t) => t.due_at && dayKey(t.due_at, timeZone) > todayKey);
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
