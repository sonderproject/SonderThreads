/**
 * Supabase Auth configuration. The URL and the anon/publishable key are
 * public by design (safe in the browser). The service role key is
 * server-only: it is read only in lib/supabase/admin.ts and must never be
 * given a NEXT_PUBLIC_ name.
 *
 * Several names are accepted because Vercel's Supabase integration and the
 * Supabase dashboard use different ones.
 */
export function supabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || undefined;
}

export function supabaseAnonKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    undefined
  );
}

/** Names of the missing settings, for a clear setup message instead of a crash. */
export function missingSupabaseConfig(): string[] {
  const missing: string[] = [];
  if (!supabaseUrl()) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseAnonKey()) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return missing;
}
