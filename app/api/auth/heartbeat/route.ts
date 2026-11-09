import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { queryOne } from "@/lib/db/client";
import { IDLE_MINUTES_COOKIE, idleMinutesFrom } from "@/lib/auth";

/**
 * "Still here" ping from the browser while someone is active. Middleware
 * refreshes the session and the last-seen time on every request that
 * reaches it (and returns 401 if the session has ended). This also tells the
 * middleware the person's idle timeout, via a cookie, for its backstop check.
 */
export async function POST() {
  const response = new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  const user = await getSessionUser();
  if (!user) return response;
  const row = await queryOne<{ idle_timeout_minutes: number }>(
    `select idle_timeout_minutes from user_settings where user_id = $1`,
    [user.id],
  );
  response.cookies.set(IDLE_MINUTES_COOKIE, String(idleMinutesFrom(row?.idle_timeout_minutes)), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
