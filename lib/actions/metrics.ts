"use server";

import { requireUserId } from "@/lib/current-user";
import { getTimeZone } from "@/lib/timezone";
import { dayKey } from "@/lib/tz";
import { computeMetrics, normalizeRange, type Metrics } from "@/lib/metrics";
import { toActionResult, type ActionResult } from "@/lib/validation";

/** Metrics for the signed-in user over local days `from`..`to` (inclusive, YYYY-MM-DD). */
export async function getMetricsSafe(from: string, to: string): Promise<ActionResult<Metrics>> {
  return toActionResult(async () => {
    const [userId, tz] = await Promise.all([requireUserId(), getTimeZone()]);
    const range = normalizeRange(from, to, dayKey(new Date(), tz));
    return computeMetrics(userId, tz, range.from, range.to);
  });
}
