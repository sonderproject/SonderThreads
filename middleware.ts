import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, getAppPassword, safeEqual, sessionToken } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const password = getAppPassword();
  const cookie = request.cookies.get(SESSION_COOKIE)?.value;

  if (password && cookie && safeEqual(cookie, await sessionToken(password))) {
    return NextResponse.next();
  }

  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/") loginUrl.searchParams.set("next", pathname + search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Everything except the login page itself and static assets (icons and the
  // manifest must load before sign-in so "Add to Home Screen" works).
  matcher: [
    "/((?!login|_next/static|_next/image|favicon.ico|robots.txt|manifest.webmanifest|icon-.*\\.png|apple-touch-icon.*\\.png).*)",
  ],
};
