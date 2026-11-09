import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth";

const TYPES: EmailOtpType[] = ["signup", "email", "recovery", "invite", "magiclink", "email_change"];

/**
 * Where links in Supabase's auth emails land (confirm email, reset
 * password). The email templates must point here with the token hash:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/
 * (see docs/auth-setup.md). Verifying the token signs the person in.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const next = safeNextPath(params.get("next"));

  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      // A password-reset link signs in only so the new password can be set.
      const to = type === "recovery" ? "/reset-password" : next;
      return NextResponse.redirect(new URL(to, request.url));
    }
    console.error("[auth] email link failed", error.code ?? error.message);
  }
  return NextResponse.redirect(new URL(type === "recovery" ? "/reset-password?error=invalid" : "/login?error=link", request.url));
}
