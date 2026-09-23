/**
 * Vercel's native Supabase integration auto-names its injected env vars
 * NEXT_PUBLIC_<project-slug>_SUPABASE_URL / _SUPABASE_ANON_KEY instead of
 * the plain NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY this
 * app otherwise expects (and documents in .env.example). Check both so it
 * works with either naming.
 *
 * NEXT_PUBLIC_* references must stay as literal `process.env.NEXT_PUBLIC_X`
 * property accesses (not computed/dynamic) for Next.js to inline them into
 * the browser bundle at build time.
 */
export function getSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_sonderthreads_SUPABASE_URL;
}

export function getSupabaseAnonKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_sonderthreads_SUPABASE_ANON_KEY
  );
}
