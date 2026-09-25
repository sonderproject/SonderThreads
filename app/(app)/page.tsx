import Link from "next/link";
import { CommandBar } from "@/components/command/CommandBar";
import { QuickActions } from "@/components/command/QuickActions";
import { PersonCard } from "@/components/people/PersonCard";
import { NoteCard } from "@/components/notes/NoteCard";
import { TaskRow } from "@/components/tasks/TaskRow";
import { MiniCalendar } from "@/components/calendar/MiniCalendar";
import { Clock } from "@/components/calendar/Clock";
import { EmptyState } from "@/components/ui/EmptyState";
import { listPeople, getPeopleNeedingAttention } from "@/lib/actions/people";
import { listTasks } from "@/lib/actions/tasks";
import { listRecentNotes } from "@/lib/actions/notes";
import { getCalendarMonth } from "@/lib/actions/calendar";
import { seedDemoDataIfEmpty } from "@/lib/actions/seed";
import { buildWeeks } from "@/lib/calendar-utils";

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isOverdue(iso: string): boolean {
  return new Date(iso).getTime() < new Date().setHours(0, 0, 0, 0);
}

export default async function DashboardPage() {
  await seedDemoDataIfEmpty();

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [people, tasks, notes, needsAttention, { tasks: monthTasks, birthdays }] = await Promise.all([
    listPeople(),
    listTasks(),
    listRecentNotes(6),
    getPeopleNeedingAttention(),
    getCalendarMonth(year, month),
  ]);

  const peopleById = new Map(people.map((c) => [c.id, c]));
  const openTasks = tasks.filter((t) => !t.completed);
  const todayTasks = openTasks.filter((t) => t.due_at && (isToday(t.due_at) || isOverdue(t.due_at)));
  const recentPeople = people.slice(0, 5);

  const eventDays = new Set<number>();
  for (const task of monthTasks) {
    if (task.due_at) eventDays.add(new Date(task.due_at).getDate());
  }
  for (const b of birthdays) eventDays.add(b.day);
  const weeks = buildWeeks(year, month);

  return (
    <div className="space-y-8">
      <section>
        <CommandBar />
        <QuickActions people={people.map((c) => ({ id: c.id, display_name: c.display_name }))} />
      </section>

      <Section title="Calendar" href="/calendar">
        <div className="grid gap-3 sm:grid-cols-2">
          <MiniCalendar year={year} month={month} weeks={weeks} eventDays={eventDays} />
          <Clock />
        </div>
      </Section>

      <Section title="Today">
        {todayTasks.length === 0 ? (
          <EmptyState message="Nothing due today." />
        ) : (
          <div className="divide-y divide-border-subtle rounded border border-border">
            {todayTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                personName={task.person_id ? peopleById.get(task.person_id)?.display_name : null}
              />
            ))}
          </div>
        )}
      </Section>

      <Section title="Needs Attention">
        {needsAttention.length === 0 ? (
          <EmptyState message="Everyone's up to date." />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {needsAttention.map((person) => (
              <PersonCard key={person.id} person={person} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Recent People" href="/people">
        {recentPeople.length === 0 ? (
          <EmptyState message="No people yet. Try: Add Marcus Johnson to Group 7" />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {recentPeople.map((person) => (
              <PersonCard key={person.id} person={person} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Recent Notes" href="/notes">
        {notes.length === 0 ? (
          <EmptyState message="No notes yet." />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                personName={note.person_id ? peopleById.get(note.person_id)?.display_name : null}
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  href,
  children,
}: {
  title: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-mono text-xs uppercase tracking-wide text-text-faint">{title}</h2>
        {href && (
          <Link href={href} className="text-xs text-text-muted hover:text-accent">
            view all
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
