import { NextResponse } from "next/server";
import { query } from "@/lib/db/client";
import { supabaseAnonKey, supabaseServiceKey, supabaseUrl } from "@/lib/supabase/env";
import { resolveConnectionString } from "@/lib/db/client";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Setup check for Supabase Auth on this deployment: open /api/auth/status.
 * Public (it must work while sign-in is broken), so it reports only
 * pass/fail and setting names, never values or any data.
 */
export async function GET() {
  const url = supabaseUrl();
  const anon = supabaseAnonKey();
  const service = supabaseServiceKey();
  const dbUrl = resolveConnectionString() ?? ""; // exactly what the app connects to

  const checks: Record<string, string> = {};
  const ok = (b: boolean, fix: string) => (b ? "✅" : `❌ ${fix}`);

  checks["1. NEXT_PUBLIC_SUPABASE_URL set"] = ok(Boolean(url), "Add it in Vercel → Settings → Environment Variables, then redeploy.");
  checks["2. NEXT_PUBLIC_SUPABASE_ANON_KEY set"] = ok(Boolean(anon), "Add it in Vercel, then redeploy.");
  checks["3. SUPABASE_SERVICE_ROLE_KEY set (server only)"] = ok(Boolean(service), "Add it in Vercel (no NEXT_PUBLIC_ prefix), then redeploy.");
  checks["4. Service role key NOT exposed to the browser"] = ok(
    !Object.keys(process.env).some((k) => k.startsWith("NEXT_PUBLIC_") && /SERVICE_ROLE|SECRET/i.test(k)),
    "Delete any NEXT_PUBLIC_ variable holding the service role/secret key, then redeploy.",
  );

  // Can this deployment reach Supabase Auth with the public key?
  if (url && anon) {
    try {
      const res = await fetch(`${url.replace(/\/+$/, "")}/auth/v1/health`, { headers: { apikey: anon }, cache: "no-store" });
      checks["5. Supabase Auth reachable with the anon key"] = ok(res.ok, `Got HTTP ${res.status}: check the URL and anon key belong to the same project.`);
    } catch {
      checks["5. Supabase Auth reachable with the anon key"] = "❌ Couldn't connect: check NEXT_PUBLIC_SUPABASE_URL.";
    }
  } else checks["5. Supabase Auth reachable with the anon key"] = "⏭ needs 1 and 2";

  // Does the service role key work (needed to migrate old accounts and delete accounts)?
  if (url && service) {
    try {
      const { error } = await createSupabaseAdmin().auth.admin.listUsers({ page: 1, perPage: 1 });
      checks["6. Service role key accepted"] = ok(!error, `Supabase said: ${error?.message}. Copy the service_role/secret key again.`);
    } catch (err) {
      checks["6. Service role key accepted"] = `❌ ${err instanceof Error ? err.message : "failed"}`;
    }
  } else checks["6. Service role key accepted"] = "⏭ needs 1 and 3";

  // Are auth and the app's data in the same Supabase project? (Catches pointing at Neon by mistake.)
  const ref = url?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1];
  checks["7. Database is the same Supabase project as Auth"] = !dbUrl
    ? "❌ No database URL set."
    : !ref
      ? "⏭ needs 1"
      : ok(dbUrl.includes(ref), "The database URL points to a different project or provider (e.g. Neon). Data must be in the Supabase project.");

  try {
    await query(`select 1 from users limit 1`);
    checks["8. Database connected"] = "✅";
  } catch {
    checks["8. Database connected"] = "❌ Couldn't query the database: check the database URL in Vercel.";
  }

  checks["9. CAPTCHA site key set (optional until you turn CAPTCHA on)"] = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? "✅" : "— not set yet";

  const allGood = Object.entries(checks).every(([k, v]) => !v.startsWith("❌") || k.startsWith("9."));
  return NextResponse.json({ ready_for_sign_in: allGood, checks }, { headers: { "Cache-Control": "no-store" } });
}
