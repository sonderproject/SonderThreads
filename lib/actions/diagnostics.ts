import { createClient } from "@/lib/supabase/server";

export type SupabaseDiagnostic =
  | { ok: true }
  | { ok: false; reason: string; detail: string };

/**
 * Checks whether this request has (or can get) a valid Supabase session,
 * without throwing. Used by the (app) layout to show the real cause of a
 * setup problem directly in the page instead of a thrown error — Next.js
 * redacts thrown Server Component error messages in production regardless
 * of error.tsx, so this is the only way to surface the actual reason.
 */
export async function checkSupabaseConnection(): Promise<SupabaseDiagnostic> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      ok: false,
      reason: "Missing environment variables",
      detail:
        "NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY are not set for this deployment.",
    };
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch (err) {
    return {
      ok: false,
      reason: "Could not create Supabase client",
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  const { data, error: getUserError } = await supabase.auth.getUser();

  if (data.user) {
    return { ok: true };
  }

  const { error: anonError } = await supabase.auth.signInAnonymously();

  if (anonError) {
    return {
      ok: false,
      reason: "Anonymous sign-in failed",
      detail: `${anonError.message}${
        anonError.message.toLowerCase().includes("disabled") ||
        anonError.message.toLowerCase().includes("not enabled") ||
        anonError.status === 422
          ? " — this usually means Anonymous Sign-ins are disabled: Supabase dashboard → Authentication → Providers → Anonymous Sign-ins → Enable."
          : ""
      }`,
    };
  }

  if (getUserError) {
    return {
      ok: false,
      reason: "Could not verify session",
      detail: getUserError.message,
    };
  }

  return { ok: true };
}
