import { NextResponse, type NextRequest } from "next/server";
import { createHash, randomBytes } from "crypto";
import { query, queryOne } from "@/lib/db/client";
import { safeEqual } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendAuthEmail } from "@/lib/auth-emails";

export const dynamic = "force-dynamic";

/** TEMPORARY one-time production check of the app-sent sign-up / reset / resend emails (removed after use). */
export async function GET(request: NextRequest) {
  const t = request.nextUrl.searchParams.get("t") ?? "";
  const row = await queryOne<{ value: string }>(`delete from app_meta where key = 'selftest_token_hash' returning value`);
  if (!row || !t || !safeEqual(createHash("sha256").update(t).digest("hex"), row.value)) return new NextResponse("Not found", { status: 404 });
  const results: Record<string, string> = {};
  const admin = createSupabaseAdmin();
  const stamp = Date.now().toString(36);
  const email = `delivered+app-${stamp}@resend.dev`;
  let userId: string | null = null;
  try {
    const su = await sendAuthEmail("signup", email, { password: `T-${randomBytes(12).toString("base64url")}`, next: "/" });
    userId = su.user?.id ?? null;
    results.signup_email = su.status === "sent" && userId ? "PASS" : `FAIL: ${su.status}`;
    const again = await sendAuthEmail("signup", email, { password: "x".repeat(12), next: "/" });
    results.signup_existing_hidden = again.status === "exists" ? "PASS" : `FAIL: ${again.status}`;
    const rs = await sendAuthEmail("resend", email, { next: "/" });
    results.resend_email = rs.status === "sent" ? "PASS" : `FAIL: ${rs.status}`;
    const rc = await sendAuthEmail("recovery", email, { next: "/reset-password" });
    results.reset_email = rc.status === "sent" ? "PASS" : `FAIL: ${rc.status}`;
    const none = await sendAuthEmail("recovery", `delivered+nobody-${stamp}@resend.dev`, { next: "/reset-password" });
    results.reset_unknown_email_quiet = none.status !== "sent" ? `PASS: ${none.status}` : "FAIL: sent";
    const sent = await queryOne<{ n: number }>(`select count(*)::int as n from app_events where kind = 'auth.email_by_app' and email = $1`, [email]);
    results.emails_logged = `${sent?.n ?? 0}`;
  } catch (err) {
    results.exception = `FAIL: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    if (userId) await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    await query(`delete from app_events where email like 'delivered+%@resend.dev'`).catch(() => undefined);
    results.cleanup = userId ? "deleted test account" : "nothing to delete";
  }
  return NextResponse.json(results, { headers: { "cache-control": "no-store" } });
}
