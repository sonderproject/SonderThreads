"use client";

import { useTerms } from "@/components/TermsProvider";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getMetricsSafe } from "@/lib/actions/metrics";
import { addDays, buildStory, type Metrics } from "@/lib/metrics-shared";
import { dayKey } from "@/lib/tz";
import { useTimeZone } from "@/components/TimeZoneProvider";

/** Home: the last 30 days in one line and three numbers, linking to the full Impact page. */
export function ImpactTeaser() {
  const terms = useTerms();
  const timeZone = useTimeZone();
  const [data, setData] = useState<Metrics | null>(null);

  useEffect(() => {
    const today = dayKey(new Date(), timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
    getMetricsSafe(addDays(today, -29), today).then((r) => r.ok && setData(r.data));
  }, [timeZone]);

  const tiles = data
    ? [
        ["People served", data.kpis.peopleServed],
        [terms.checkIns, data.kpis.checkIns],
        ["Tasks completed", data.kpis.tasksDone],
      ]
    : null;

  return (
    <Link href="/impact" className="card block space-y-3 p-4 transition-colors hover:bg-bg-hover">
      <p className="text-sm text-text">{data ? buildStory(data, { audience: terms.audience })[0].replace(/check-ins/g, terms.checkInsLower) : "Loading the last 30 days…"}</p>
      <div className="grid grid-cols-3 gap-2">
        {(tiles ?? [["", null], ["", null], ["", null]]).map(([label, n], i) => (
          <div key={i}>
            <p className="font-display text-2xl font-light tabular-nums text-text">{n === null ? "–" : Number(n).toLocaleString()}</p>
            <p className="text-xs text-text-muted">{label}</p>
          </div>
        ))}
      </div>
      <p className="text-sm font-medium text-accent">See the full report →</p>
    </Link>
  );
}
