import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "crypto";
import { queryOne } from "@/lib/db/client";
import { safeEqual } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { appUrl } from "@/lib/email";

export const dynamic = "force-dynamic";

/** TEMPORARY one-time check that Supabase's own email sending works (removed after use). */
export async function GET(request: NextRequest) {
  const t = request.nextUrl.searchParams.get("t") ?? "";
  const row = await queryOne<{ value: string }>(`delete from app_meta where key = 'selftest_token_hash' returning value`);
  if (!row || !t || !safeEqual(createHash("sha256").update(t).digest("hex"), row.value)) return new NextResponse("Not found", { status: 404 });
  const admin = createSupabaseAdmin();
  const email = `delivered+smtp-${Date.now().toString(36)}@resend.dev`;
  const results: Record<string, string> = { app_sender: process.env.EMAIL_FROM?.replace(/^.*</, "<") ?? "(not set)" };
  const cu = await admin.auth.admin.createUser({ email, password: `T-${Date.now()}-x9!`, email_confirm: true });
  const r = await admin.auth.resetPasswordForEmail(email, { redirectTo: `${appUrl()}/auth/confirm?next=%2Freset-password` });
  results.supabase_email_sending = r.error ? `FAIL: ${r.error.message}` : "PASS";
  if (cu.data.user) await admin.auth.admin.deleteUser(cu.data.user.id).catch(() => undefined);
  return NextResponse.json(results, { headers: { "cache-control": "no-store" } });
}
