import { getCalendarMonth } from "@/lib/actions/calendar";
import { listPeople } from "@/lib/actions/people";
import { CalendarGrid } from "@/components/calendar/CalendarGrid";
import { NewCalendarEventButton } from "@/components/calendar/NewCalendarEventButton";
import { buildWeeks, groupTasksByDay, groupBirthdaysByDay } from "@/lib/calendar-utils";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const year = sp.year ? parseInt(sp.year, 10) : now.getFullYear();
  const month = sp.month ? parseInt(sp.month, 10) : now.getMonth() + 1;

  const [{ tasks, birthdays }, people] = await Promise.all([
    getCalendarMonth(year, month),
    listPeople(),
  ]);

  const tasksByDay = groupTasksByDay(tasks);
  const birthdaysByDay = groupBirthdaysByDay(birthdays);
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
            people={people.map((c) => ({ id: c.id, display_name: c.display_name }))}
          />
        </div>
      </div>

      <CalendarGrid
        year={year}
        month={month}
        weeks={weeks}
        tasksByDay={tasksByDay}
        birthdaysByDay={birthdaysByDay}
        people={people.map((c) => ({ id: c.id, display_name: c.display_name }))}
      />
    </div>
  );
}
