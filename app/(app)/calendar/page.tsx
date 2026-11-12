import { getCalendarRange } from "@/lib/actions/calendar";
import { listPeople } from "@/lib/actions/people";
import { CalendarView } from "@/components/calendar/CalendarView";
import { CALENDAR_VIEWS, isDayKey, makeKey, viewRange, type CalendarView as View } from "@/lib/calendar-items";
import { getTimeZone } from "@/lib/timezone";
import { dayKey } from "@/lib/tz";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string; year?: string; month?: string }>;
}) {
  const sp = await searchParams;
  const view: View = CALENDAR_VIEWS.includes(sp.view as View) ? (sp.view as View) : "month";

  // ?date=YYYY-MM-DD, or the older ?year=&month= links (home page mini calendar). Malformed values fall back to today.
  const today = dayKey(new Date(), await getTimeZone());
  const y = Number(sp.year);
  const m = Number(sp.month);
  const legacy = Number.isInteger(y) && Number.isInteger(m) && m >= 1 && m <= 12 ? makeKey(y, m, 1) : null;
  const anchor = isDayKey(sp.date) ? sp.date : legacy && isDayKey(legacy) ? legacy : today;

  const [{ items, feeds, today: todayKey }, people] = await Promise.all([getCalendarRange(view, anchor), listPeople()]);

  return (
    <CalendarView
      view={view}
      anchor={anchor}
      range={viewRange(view, anchor)}
      today={todayKey}
      items={items}
      feeds={feeds}
      people={people.map((p) => ({ id: p.id, display_name: p.display_name }))}
    />
  );
}
