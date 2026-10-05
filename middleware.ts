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
  // Signed-out visitors to the home page get the public landing page, at the
  // same address, so search engines and shared links see what the app is.
  if (pathname === "/") return NextResponse.rewrite(new URL("/welcome", request.url));

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname + search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Everything except the sign-in/sign-up/password-reset pages, the landing page, the sitemap and static assets (icons and
  // the manifest must load before sign-in so "Add to Home Screen" works).
  matcher: [
    "/((?!login|signup|forgot-password|reset-password|welcome|sitemap.xml|sw.js|_next/static|_next/image|favicon.ico|robots.txt|manifest.webmanifest|icon-.*\\.png|apple-touch-icon.*\\.png).*)",
  ],
};
