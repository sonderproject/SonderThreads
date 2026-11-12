import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { queryOne } from "@/lib/db/client";
import { IDLE_MINUTES_COOKIE, STAY_SIGNED_IN, defaultIdleMinutes, idleMinutesFrom } from "@/lib/auth";

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
  const row = await queryOne<{ idle_timeout_minutes: number | null; stay_signed_in: boolean | null; chosen: boolean | null; in_org: boolean }>(
    `select s.idle_timeout_minutes, s.stay_signed_in, s.idle_timeout_chosen as chosen,
            exists (select 1 from memberships m where m.user_id = $1 and m.active) as in_org
       from (select $1::uuid as id) u left join user_settings s on s.user_id = u.id`,
    [user.id],
  );
  const minutes = row?.chosen ? idleMinutesFrom(row.idle_timeout_minutes) : defaultIdleMinutes(Boolean(row?.in_org));
  const value = row?.stay_signed_in ? STAY_SIGNED_IN : String(minutes);
  response.cookies.set(IDLE_MINUTES_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
