import { cache } from "react";
import { cookies } from "next/headers";
import { TZ_COOKIE, isValidTimeZone } from "@/lib/tz";

/**
 * The viewer's IANA time zone, from the cookie the browser sets on every
 * page load (app/layout.tsx). Falls back to UTC on the very first visit.
 */
export const getTimeZone = cache(async (): Promise<string> => {
  const tz = (await cookies()).get(TZ_COOKIE)?.value;
  const decoded = tz ? decodeURIComponent(tz) : null;
  return isValidTimeZone(decoded) ? decoded : "UTC";
});
