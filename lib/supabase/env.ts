/**
 * Supabase Auth configuration. The URL and the anon/publishable key are
 * public by design (safe in the browser). The service role key is
 * server-only: it is read only on the server (lib/supabase/admin.ts) and
 * must never be given a NEXT_PUBLIC_ name.
 *
 * Vercel's Supabase integration names its variables with a prefix when the
 * project has more than one database connected (here: `sonderthreads_...`,
 * e.g. `sonderthreads_SUPABASE_URL`). So besides the standard names, any
 * variable *ending* in the standard name is accepted. Only read on the
 * server (middleware runs on Node), where all variables are visible.
 */

function find(suffixes: string[], exclude?: RegExp): string | undefined {
  // Exact standard names first.
  for (const name of suffixes) {
    const v = process.env[name];
    if (v) return v;
  }
  // Then prefixed ones, e.g. sonderthreads_SUPABASE_URL or NEXT_PUBLIC_sonderthreads_SUPABASE_URL.
  for (const [name, value] of Object.entries(process.env)) {
    if (!value || (exclude && exclude.test(name))) continue;
    if (suffixes.some((s) => name.toUpperCase().endsWith(`_${s}`))) return value;
  }
  return undefined;
}

export function supabaseUrl(): string | undefined {
  return find(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"]);
}

export function supabaseAnonKey(): string | undefined {
  return find([
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_ANON_KEY",
  ]);
}

/** Server-only. Never expose to the browser. */
export function supabaseServiceKey(): string | undefined {
  // NEXT_PUBLIC_ names are skipped on purpose: a secret must never be public.
  return find(["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"], /^NEXT_PUBLIC_/i);
}

/** Names of the missing settings, for a clear setup message instead of a crash. */
export function missingSupabaseConfig(): string[] {
  const missing: string[] = [];
  if (!supabaseUrl()) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseAnonKey()) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return missing;
}
