import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

/**
 * First-pass gate: sends anyone without a session cookie (or bearer token)
 * to sign-in. Middleware runs on the Edge and can't reach Postgres, so it
 * only checks that a token is present — requireUserId()/getSessionUser()
 * validate it against the sessions table on every data access.
 */
export function middleware(request: NextRequest) {
  const hasToken =
    !!request.cookies.get(SESSION_COOKIE)?.value ||
    !!request.headers.get("authorization")?.toLowerCase().startsWith("bearer ");
  if (hasToken) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/") loginUrl.searchParams.set("next", pathname + search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Everything except the sign-in/sign-up pages and static assets (icons and
  // the manifest must load before sign-in so "Add to Home Screen" works).
  matcher: [
    "/((?!login|signup|_next/static|_next/image|favicon.ico|robots.txt|manifest.webmanifest|icon-.*\\.png|apple-touch-icon.*\\.png).*)",
  ],
};
