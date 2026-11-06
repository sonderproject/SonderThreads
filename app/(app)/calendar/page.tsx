import { getCalendarMonth } from "@/lib/actions/calendar";
import { listPeople } from "@/lib/actions/people";
import { CalendarGrid } from "@/components/calendar/CalendarGrid";
import { NewCalendarEventButton } from "@/components/calendar/NewCalendarEventButton";
import { buildWeeks, groupTasksByDay, groupBirthdaysByDay } from "@/lib/calendar-utils";
import { getTimeZone } from "@/lib/timezone";
import { dateParts, dayKey } from "@/lib/tz";

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
  const timeZone = await getTimeZone();
  const now = dateParts(new Date(), timeZone);
  // Ignore malformed ?year=/&month= rather than rendering "NaN".
  const y = Number(sp.year);
  const m = Number(sp.month);
  const year = Number.isInteger(y) && y >= 1900 && y <= 2200 ? y : now.year;
  const month = Number.isInteger(m) && m >= 1 && m <= 12 ? m : now.month;

  const [{ tasks, birthdays }, people] = await Promise.all([
    getCalendarMonth(year, month, timeZone),
    listPeople(),
  ]);

  const tasksByDay = groupTasksByDay(tasks, timeZone);
  const birthdaysByDay = groupBirthdaysByDay(birthdays);
  const weeks = buildWeeks(year, month, dayKey(new Date(), timeZone));

  const prevMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Calendar</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 tabular-nums text-sm">
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
