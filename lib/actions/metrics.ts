"use server";

import { requireUserId } from "@/lib/current-user";
import { getTimeZone } from "@/lib/timezone";
import { dayKey } from "@/lib/tz";
import { getMembership } from "@/lib/org";
import { computeMetrics, normalizeRange, type Metrics } from "@/lib/metrics";
import type { MetricsScope } from "@/lib/metrics-shared";
import { toActionResult, type ActionResult } from "@/lib/validation";

/** The organization to report on, if the signed-in person may see it (active admin or supervisor). */
export async function reportableOrg(): Promise<{ id: string; name: string } | null> {
  const m = await getMembership();
  return m?.active && m.role !== "case_manager" ? { id: m.orgId, name: m.orgName } : null;
}

/**
 * Metrics over local days `from`..`to` (inclusive, YYYY-MM-DD): the signed-in
 * user's own, or their organization's (admins and supervisors only).
 */
export async function getMetricsSafe(from: string, to: string, scope: MetricsScope = "me"): Promise<ActionResult<Metrics>> {
  return toActionResult(async () => {
    const [userId, tz] = await Promise.all([requireUserId(), getTimeZone()]);
    const range = normalizeRange(from, to, dayKey(new Date(), tz));
    const org = scope === "org" ? await reportableOrg() : null;
    if (scope === "org" && !org) throw new Error("Only organization admins and supervisors can see organization-wide numbers.");
    return computeMetrics(userId, tz, range.from, range.to, org);
  });
}
