import type { Task } from "@/lib/types";
import type { CalendarBirthday } from "@/lib/actions/calendar";

export type CalendarDay = { dayNum: number | null; isToday: boolean };

export function buildWeeks(year: number, month: number): CalendarDay[][] {
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

export function groupTasksByDay(tasks: Task[]): Record<number, Task[]> {
  const byDay: Record<number, Task[]> = {};
  for (const task of tasks) {
    if (!task.due_at) continue;
    const day = new Date(task.due_at).getDate();
    (byDay[day] ??= []).push(task);
  }
  return byDay;
}

export function groupBirthdaysByDay(
  birthdays: CalendarBirthday[],
): Record<number, { clientId: string; displayName: string }[]> {
  const byDay: Record<number, { clientId: string; displayName: string }[]> = {};
  for (const b of birthdays) {
    (byDay[b.day] ??= []).push({ clientId: b.clientId, displayName: b.displayName });
  }
  return byDay;
}
