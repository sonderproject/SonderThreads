import { CheckInsBrowser } from "@/components/check-ins/CheckInsBrowser";
import { getTerms } from "@/lib/terms-server";
import { listCheckIns, listCheckInReasons } from "@/lib/actions/check-ins";
import { listPeople } from "@/lib/actions/people";
import { getMembership } from "@/lib/org";
import { DEFAULT_RANGE_DAYS, addDays, isDayKey } from "@/components/check-ins/range";

/**
 * ?from=YYYY-MM-DD&to=YYYY-MM-DD picks the days shown (default: the last
 * DEFAULT_RANGE_DAYS days); ?all=1 shows everything.
 */
export default async function CheckInsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; all?: string }>;
}) {
  const terms = await getTerms();
  const sp = await searchParams;
  const all = sp.all === "1";
  const today = new Date().toISOString().slice(0, 10);
  const to = isDayKey(sp.to) ? sp.to : today;
  const from = isDayKey(sp.from) ? sp.from : addDays(to, -(DEFAULT_RANGE_DAYS - 1));

  // One extra day on each side covers every time zone; the browser trims to exact local days.
  const membership = await getMembership();
  const [checkIns, people, reasons] = await Promise.all([
    listCheckIns(all ? {} : { from: `${addDays(from, -1)}T00:00:00Z`, to: `${addDays(to, 2)}T00:00:00Z` }),
    listPeople(),
    listCheckInReasons(),
  ]);
  const sortedPeople = people
    .map((p) => ({ id: p.id, display_name: p.display_name }))
    .sort((a, b) => a.display_name.localeCompare(b.display_name));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">{terms.checkIns}</h1>
        {membership?.active && (
          <a href="/kiosk" className="rounded-full border border-border px-4 py-1.5 text-sm font-medium text-text hover:bg-bg-hover">
            Front-desk kiosk
          </a>
        )}
      </div>
      <CheckInsBrowser
        checkIns={checkIns}
        people={sortedPeople}
        reasons={reasons}
        range={all ? null : { from, to }}
        hasParams={Boolean(sp.from || sp.to || all)}
      />
    </div>
  );
}
