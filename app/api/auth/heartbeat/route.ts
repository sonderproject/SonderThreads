import { NextResponse } from "next/server";

/**
 * "Still here" ping from the browser while someone is active. The work is
 * done by middleware, which refreshes the session and the last-seen time on
 * every request that reaches it (and returns 401 if the session has ended).
 */
export function POST() {
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
