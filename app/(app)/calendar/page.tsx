import { getCalendarMonth } from "@/lib/actions/calendar";
import { listClients } from "@/lib/actions/clients";
import { CalendarGrid, type CalendarDay } from "@/components/calendar/CalendarGrid";
import { NewCalendarEventButton } from "@/components/calendar/NewCalendarEventButton";
import type { Task } from "@/lib/types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function buildWeeks(year: number, month: number): CalendarDay[][] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const startWeekday = new Date(year, month - 1, 1).getDay();
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
  const today = new Date();

  const days: CalendarDay[] = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startWeekday + 1;
    const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
    days.push({
      dayNum: inMonth ? dayNum : null,
      isToday:
        inMonth &&
        year === today.getFullYear() &&
        month === today.getMonth() + 1 &&
        dayNum === today.getDate(),
    });
  }

  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const year = sp.year ? parseInt(sp.year, 10) : now.getFullYear();
  const month = sp.month ? parseInt(sp.month, 10) : now.getMonth() + 1;

  const [{ tasks, birthdays }, clients] = await Promise.all([
    getCalendarMonth(year, month),
    listClients(),
  ]);

  const tasksByDay: Record<number, Task[]> = {};
  for (const task of tasks) {
    if (!task.due_at) continue;
    const day = new Date(task.due_at).getDate();
    (tasksByDay[day] ??= []).push(task);
  }

  const birthdaysByDay: Record<number, { clientId: string; displayName: string }[]> = {};
  for (const b of birthdays) {
    (birthdaysByDay[b.day] ??= []).push({ clientId: b.clientId, displayName: b.displayName });
  }

  const weeks = buildWeeks(year, month);

  const prevMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-mono text-xs uppercase tracking-wide text-text-faint">Calendar</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 font-mono text-sm">
            <a
              href={`/calendar?year=${prevMonth.year}&month=${prevMonth.month}`}
              className="text-text-muted hover:text-accent"
            >
              ‹
            </a>
            <span className="text-text">
              {MONTH_NAMES[month - 1]} {year}
            </span>
            <a
              href={`/calendar?year=${nextMonth.year}&month=${nextMonth.month}`}
              className="text-text-muted hover:text-accent"
            >
              ›
            </a>
          </div>
          <NewCalendarEventButton
            clients={clients.map((c) => ({ id: c.id, display_name: c.display_name }))}
          />
        </div>
      </div>

      <CalendarGrid
        year={year}
        month={month}
        weeks={weeks}
        tasksByDay={tasksByDay}
        birthdaysByDay={birthdaysByDay}
        clients={clients.map((c) => ({ id: c.id, display_name: c.display_name }))}
      />
    </div>
  );
}
