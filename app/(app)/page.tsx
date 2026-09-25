import Link from "next/link";
import { CommandBar } from "@/components/command/CommandBar";
import { QuickActions } from "@/components/command/QuickActions";
import { ClientCard } from "@/components/clients/ClientCard";
import { NoteCard } from "@/components/notes/NoteCard";
import { TaskRow } from "@/components/tasks/TaskRow";
import { MiniCalendar } from "@/components/calendar/MiniCalendar";
import { EmptyState } from "@/components/ui/EmptyState";
import { listClients, getClientsNeedingAttention } from "@/lib/actions/clients";
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

  const [clients, tasks, notes, needsAttention, { tasks: monthTasks, birthdays }] = await Promise.all([
    listClients(),
    listTasks(),
    listRecentNotes(6),
    getClientsNeedingAttention(),
    getCalendarMonth(year, month),
  ]);

  const clientsById = new Map(clients.map((c) => [c.id, c]));
  const openTasks = tasks.filter((t) => !t.completed);
  const todayTasks = openTasks.filter((t) => t.due_at && (isToday(t.due_at) || isOverdue(t.due_at)));
  const recentClients = clients.slice(0, 5);

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
        <QuickActions clients={clients.map((c) => ({ id: c.id, display_name: c.display_name }))} />
      </section>

      <Section title="Calendar" href="/calendar">
        <MiniCalendar year={year} month={month} weeks={weeks} eventDays={eventDays} />
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
                clientName={task.client_id ? clientsById.get(task.client_id)?.display_name : null}
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
            {needsAttention.map((client) => (
              <ClientCard key={client.id} client={client} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Recent Clients" href="/clients">
        {recentClients.length === 0 ? (
          <EmptyState message="No clients yet. Try: Add Marcus Johnson to Cohort 7" />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {recentClients.map((client) => (
              <ClientCard key={client.id} client={client} />
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
                clientName={note.client_id ? clientsById.get(note.client_id)?.display_name : null}
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
