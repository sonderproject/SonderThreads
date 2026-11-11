import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth";
import { alertOwner, logEvent } from "@/lib/events";

const TYPES: EmailOtpType[] = ["signup", "email", "recovery", "invite", "magiclink", "email_change"];

/**
 * Where links in Supabase's auth emails land (confirm email, reset
 * password). The email templates must point here with the token hash:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/
 * (see docs/auth-setup.md). GET shows a Confirm button (/auth/verify); the
 * button POSTs back here, and verifying the token signs the person in.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const next = safeNextPath(params.get("next"));

  // Supabase's default email templates (before they're switched to the token-hash
  // links in docs/auth-setup.md) send a one-time ?code= instead. It works when the
  // link is opened in the same browser that signed up or asked for the reset.
  const code = params.get("code");
  if (code && !tokenHash) {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      void data;
      return NextResponse.redirect(new URL(next, request.url));
    }
    console.error("[auth] email link (code) failed", error.code ?? error.message);
    await linkFailed("code", error.code ?? error.message);
  }

  // Opening the link only shows a "Confirm" button (/auth/verify). Email security
  // scanners (common at agencies) open every link in a message; if opening it
  // used the one-time token, the person's own click would then fail.
  if (tokenHash && type && TYPES.includes(type)) {
    const to = new URL("/auth/verify", request.url);
    to.search = new URLSearchParams({ token_hash: tokenHash, type, next }).toString();
    return NextResponse.redirect(to);
  }
  if (!tokenHash && !code) await linkFailed(type ?? "unknown", "link had no token");
  return NextResponse.redirect(new URL(type === "recovery" ? "/reset-password?error=invalid" : "/login?error=link", request.url));
}

/** The "Confirm" button on /auth/verify: only a person pressing it uses the one-time token. */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const tokenHash = form.get("token_hash")?.toString() ?? "";
  const type = (form.get("type")?.toString() ?? "") as EmailOtpType;
  const next = safeNextPath(form.get("next")?.toString());
  const back = (path: string) => NextResponse.redirect(new URL(path, request.url), 303);
  if (!tokenHash || !TYPES.includes(type)) return back(type === "recovery" ? "/reset-password?error=invalid" : "/login?error=link");
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (!error) {
    // A password-reset link signs in only so the new password can be set.
    return back(type === "recovery" ? "/reset-password" : next);
  }
  console.error("[auth] email link failed", error.code ?? error.message);
  await linkFailed(type, error.code ?? error.message);
  return back(type === "recovery" ? "/reset-password?error=invalid" : "/login?error=link");
}

/** Someone clicked an email link that didn't work: record it and tell the owner. */
async function linkFailed(type: string, reason: string) {
  await logEvent("auth.link_failed", `Email link failed (${type}): ${reason}`, { level: "warn", path: "/auth/confirm", meta: { type, reason } });
  await alertOwner(
    "An email link failed",
    [
      `Someone clicked a ${type === "recovery" ? "password-reset" : "confirmation"} link and it didn't work (${reason}).`,
      "Check the command center's Needs attention list; you can resend their email from there.",
    ],
    { everyMinutes: 60 },
  );
}
