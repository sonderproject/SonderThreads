import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Single-user mode: instead of gating the app behind a login screen, we
 * transparently create a Supabase anonymous session on first visit. This
 * still gives every row a real auth.uid() so RLS applies normally, and the
 * /login page (email/magic-link) can be wired back in later without any
 * schema changes — an anonymous user can be upgraded via
 * supabase.auth.updateUser / linkIdentity when that day comes.
 *
 * This must never throw: middleware runs on every request, and an
 * unhandled error here takes down the whole app with a platform-level
 * MIDDLEWARE_INVOCATION_FAILED instead of the app's own, more useful error
 * page. If Supabase isn't reachable/configured yet, we just let the
 * request through — the page itself will surface a clear error.
 */
export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "[middleware] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set",
    );
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      await supabase.auth.signInAnonymously();
    }
  } catch (err) {
    console.error("[middleware] Supabase session setup failed", err);
  }

  return response;
}
