"use server";

import { requireUserId } from "@/lib/current-user";
import { getTimeZone } from "@/lib/timezone";
import { dayKey } from "@/lib/tz";
import { getMembership } from "@/lib/org";
import { computeMetrics, normalizeRange, type Metrics } from "@/lib/metrics";
import type { MetricsScope } from "@/lib/metrics-shared";
import { toActionResult, type ActionResult } from "@/lib/validation";
import { getOrgTimeZone } from "@/lib/referral-settings";

/** The organization to report on, if the signed-in person may see it (active admin or supervisor), with its time zone. */
export async function reportableOrg(): Promise<{ id: string; name: string; timeZone: string } | null> {
  const m = await getMembership();
  if (!m?.active || m.role === "case_manager") return null;
  return { id: m.orgId, name: m.orgName, timeZone: await getOrgTimeZone(m.orgId) };
}

/**
 * Metrics over local days `from`..`to` (inclusive, YYYY-MM-DD): the signed-in
 * user's own, or their organization's (admins and supervisors only).
 */
export async function getMetricsSafe(from: string, to: string, scope: MetricsScope = "me"): Promise<ActionResult<Metrics>> {
  return toActionResult(async () => {
    const [userId, viewerTz] = await Promise.all([requireUserId(), getTimeZone()]);
    const org = scope === "org" ? await reportableOrg() : null;
    if (scope === "org" && !org) throw new Error("Only organization admins and managers can see organization-wide numbers.");
    // Organization reports count days in the organization's time zone, so every admin sees the same numbers.
    const tz = org?.timeZone ?? viewerTz;
    const range = normalizeRange(from, to, dayKey(new Date(), tz));
    return computeMetrics(userId, tz, range.from, range.to, org);
  });
}
