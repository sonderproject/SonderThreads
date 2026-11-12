import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { IDLE_MINUTES_COOKIE, KIOSK_COOKIE, LAST_SEEN_COOKIE, idleMinutesFrom } from "@/lib/auth";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";

/**
 * Runs before every app page and API route:
 * 1. Refreshes the Supabase Auth session (Server Components can't write cookies).
 * 2. Idle timeout backstop: if the last request was more than
 *    the person's idle timeout ago, signs out (the browser also does this itself).
 * 3. Sends signed-out visitors to sign-in (API routes get a 401).
 * The real authorization check (incl. 2FA) is requireUserId()/getSessionUser().
 */
export async function middleware(request: NextRequest) {
  // Native apps send a Supabase access token; it's verified in getSessionUser().
  if (request.headers.get("authorization")?.toLowerCase().startsWith("bearer ")) return NextResponse.next();

  const url = supabaseUrl();
  const key = supabaseAnonKey();
  if (!url || !key) return signedOut(request); // sign-in page explains what's missing

  // Lets server layouts know the path (e.g. to skip the start-your-trial step on the billing page itself).
  request.headers.set("x-pathname", request.nextUrl.pathname);
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return signedOut(request, response);

  const now = Date.now();
  const lastSeen = Number(request.cookies.get(LAST_SEEN_COOKIE)?.value);
  // Front-desk kiosk: the tablet stays on the check-in screen and stays signed in while it waits.
  const kiosk = request.cookies.get(KIOSK_COOKIE)?.value === "1";
  if (kiosk) {
    const p = request.nextUrl.pathname;
    if (!p.startsWith("/kiosk") && p !== "/api/auth/heartbeat") {
      const out = NextResponse.redirect(new URL("/kiosk", request.url));
      for (const c of response.cookies.getAll()) out.cookies.set(c);
      return out;
    }
  }
  const idleLimit = kiosk ? null : idleMinutesFrom(request.cookies.get(IDLE_MINUTES_COOKIE)?.value); // null = no idle sign-out
  if (idleLimit !== null && Number.isFinite(lastSeen) && lastSeen > 0 && now - lastSeen > idleLimit * 60_000) {
    await supabase.auth.signOut();
    const out = signedOut(request, response, "idle");
    out.cookies.delete(LAST_SEEN_COOKIE);
    return out;
  }
  // Link prefetches aren't the person doing anything, so they don't count as activity.
  if (!request.headers.get("next-router-prefetch")) {
    response.cookies.set(LAST_SEEN_COOKIE, String(now), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return response;
}

/** Signed-out handling, carrying over any auth cookies Supabase just cleared or refreshed. */
function signedOut(request: NextRequest, from?: NextResponse, reason?: "idle"): NextResponse {
  const { pathname, search } = request.nextUrl;
  let out: NextResponse;
  // Signed-out visitors to the home page get the public landing page, at the
  // same address, so search engines and shared links see what the app is.
  if (pathname === "/" && !reason) out = NextResponse.rewrite(new URL("/welcome", request.url));
  else if (pathname.startsWith("/api/")) out = NextResponse.json({ error: "Not signed in" }, { status: 401 });
  else {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("next", pathname + search);
    if (reason) loginUrl.searchParams.set("reason", reason);
    out = NextResponse.redirect(loginUrl);
  }
  for (const c of from?.cookies.getAll() ?? []) out.cookies.set(c);
  return out;
}

export const config = {
  // Node runtime (stable in Next 15.5) so the Supabase settings are read the same way as on the server,
  // including Vercel's prefixed variable names.
  runtime: "nodejs",
  // Everything except sign-in/up/password pages, the calendar subscribe feed (its link carries its own secret), the public legal pages, the email-link handler (/auth/...), the landing page, the sitemap
  // and static assets (icons and the manifest must load before sign-in so "Add to Home Screen" works).
  matcher: [
    "/((?!login|signup|refer/|api/stripe/webhook|api/calendar/feed/|privacy|terms|account-deletion|brand/|forgot-password|reset-password|auth/|api/auth/status|welcome|sitemap.xml|sw.js|_next/static|_next/image|favicon.ico|robots.txt|manifest.webmanifest|icon-.*\\.png|apple-touch-icon.*\\.png).*)",
  ],
};
