
export type CalendarDay = { dayNum: number | null; isToday: boolean };

/** `todayKey` is today's "YYYY-MM-DD" in the viewer's zone (lib/tz dayKey). */
export function buildWeeks(year: number, month: number, todayKey: string): CalendarDay[][] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const startWeekday = new Date(year, month - 1, 1).getDay();
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
  const [ty, tm, td] = todayKey.split("-").map(Number);

  const days: CalendarDay[] = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startWeekday + 1;
    const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
    days.push({
      dayNum: inMonth ? dayNum : null,
      isToday:
        inMonth &&
        year === ty &&
        month === tm &&
        dayNum === td,
    });
  }

  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}
