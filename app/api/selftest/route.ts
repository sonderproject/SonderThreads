import { NextResponse, type NextRequest } from "next/server";
import { createHash, randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { query, queryOne } from "@/lib/db/client";
import { safeEqual } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";
import { computeMetrics } from "@/lib/metrics";
import { appUrl } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * TEMPORARY one-time production check (Nov 15, 2026), removed right after use.
 * Runs the sign-in / sign-up / reset backups and the Impact report against production.
 * Needs a one-time token whose hash was put in app_meta ('selftest_token_hash'); it's
 * deleted on first use. Test accounts use Resend's test inbox and are deleted afterwards.
 * Returns pass/fail only (no personal data).
 */
export async function GET(request: NextRequest) {
  const t = request.nextUrl.searchParams.get("t") ?? "";
  const row = await queryOne<{ value: string }>(`delete from app_meta where key = 'selftest_token_hash' returning value`);
  const hash = createHash("sha256").update(t).digest("hex");
  if (!row || !t || !safeEqual(hash, row.value)) return new NextResponse("Not found", { status: 404 });

  const results: Record<string, string> = {};
  const admin = createSupabaseAdmin();
  const anon = createClient(supabaseUrl()!, supabaseAnonKey()!, { auth: { persistSession: false, autoRefreshToken: false } });
  const stamp = Date.now().toString(36);
  const pw = `T-${randomBytes(12).toString("base64url")}`;
  const signupEmail = `delivered+signup-${stamp}@resend.dev`;
  const loginEmail = `delivered+login-${stamp}@resend.dev`;
  const created: string[] = [];
  const note = (k: string, ok: boolean, detail = "") => (results[k] = `${ok ? "PASS" : "FAIL"}${detail ? `: ${detail}` : ""}`);

  try {
    // 1. CAPTCHA is on: a normal request without a token is refused (so the backups are what make it work).
    const plain = await anon.auth.signInWithPassword({ email: loginEmail, password: pw });
    note("captcha_enforced_without_token", plain.error?.code === "captcha_failed", plain.error?.code ?? "no error");

    // 2. Sign-up backup: service key, no CAPTCHA token, confirmation email sent.
    const su = await admin.auth.signUp({ email: signupEmail, password: pw, options: { emailRedirectTo: `${appUrl()}/auth/confirm?next=%2F` } });
    if (su.data.user) created.push(su.data.user.id);
    note("signup_backup", !su.error && Boolean(su.data.user), su.error?.code ?? su.error?.message ?? "");

    // 3. Sign-in backup on a confirmed account.
    const cu = await admin.auth.admin.createUser({ email: loginEmail, password: pw, email_confirm: true });
    if (cu.data.user) created.push(cu.data.user.id);
    const si = await admin.auth.signInWithPassword({ email: loginEmail, password: pw });
    note("signin_backup", !si.error && Boolean(si.data.session), si.error?.code ?? "");
    const wrong = await admin.auth.signInWithPassword({ email: loginEmail, password: `${pw}x` });
    note("signin_backup_rejects_wrong_password", wrong.error?.code === "invalid_credentials", wrong.error?.code ?? "accepted!");

    // 4. Password-reset backup.
    const rs = await admin.auth.resetPasswordForEmail(loginEmail, { redirectTo: `${appUrl()}/auth/confirm?next=%2Freset-password` });
    note("reset_backup", !rs.error, rs.error?.code ?? rs.error?.message ?? "");

    // 5. Resend-confirmation backup (may hit Supabase's 60-second resend limit right after sign-up).
    const rr = await admin.auth.resend({ type: "signup", email: signupEmail, options: { emailRedirectTo: `${appUrl()}/auth/confirm?next=%2F` } });
    note("resend_backup", !rr.error || rr.error.code === "over_email_send_rate_limit", rr.error?.code ?? "");
  } catch (err) {
    results.auth_exception = `FAIL: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    for (const id of created) await admin.auth.admin.deleteUser(id).catch(() => undefined);
    await query(`delete from users where id = any($1::uuid[])`, [created]).catch(() => undefined);
    results.cleanup = `deleted ${created.length} test accounts`;
  }

  // 6. Impact/Insights for every organization (as one of its admins) and a few individuals: errors only, no numbers.
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const orgs = await query<{ id: string; name: string; admin: string }>(
    `select o.id, o.name, (select m.user_id from memberships m where m.org_id = o.id and m.active and m.role = 'admin' limit 1) as admin
       from organizations o`,
  );
  let orgOk = 0;
  const orgFail: string[] = [];
  for (const o of orgs) {
    if (!o.admin) continue;
    try {
      await computeMetrics(o.admin, "America/Los_Angeles", from, to, { id: o.id, name: o.name });
      orgOk++;
    } catch (err) {
      orgFail.push(err instanceof Error ? err.message : String(err));
    }
  }
  note("impact_org_reports", orgFail.length === 0, `${orgOk} ok${orgFail.length ? `, ${orgFail.length} failed: ${orgFail[0]}` : ""}`);
  const solo = await query<{ id: string }>(`select id from users order by created_at desc limit 5`);
  let soloOk = 0;
  const soloFail: string[] = [];
  for (const u of solo) {
    try {
      await computeMetrics(u.id, "America/Los_Angeles", from, to, null);
      soloOk++;
    } catch (err) {
      soloFail.push(err instanceof Error ? err.message : String(err));
    }
  }
  note("impact_personal_reports", soloFail.length === 0, `${soloOk} ok${soloFail.length ? `, ${soloFail.length} failed: ${soloFail[0]}` : ""}`);

  return NextResponse.json(results, { headers: { "cache-control": "no-store" } });
}
