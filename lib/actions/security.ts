"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { query } from "@/lib/db/client";
import { safeNextPath } from "@/lib/auth";
import { getAuthState } from "@/lib/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import { toActionResult, type ActionResult } from "@/lib/validation";

/**
 * Two-factor authentication with Supabase Auth's built-in TOTP MFA
 * (authenticator apps). users.mfa_enabled mirrors "has a verified factor" and
 * is only changed here, after Supabase confirms; getAuthState() uses it to
 * require a 2FA-verified (aal2) session before any data is shown.
 */

const CODE_RE = /^\d{6}$/;

async function signedInUserId(): Promise<string> {
  const state = await getAuthState();
  if (state.status !== "signed-in") throw new Error("Please sign in again.");
  return state.user.id;
}

async function verifiedTotpFactorId(): Promise<string | null> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw new Error(error.message);
  return data.totp.find((f) => f.status === "verified")?.id ?? null;
}

export type TotpEnrollment = { factorId: string; qrCode: string; secret: string };

/** Starts setup: returns a QR code (and the text secret) for the authenticator app. */
export async function startTotpEnroll(): Promise<ActionResult<TotpEnrollment>> {
  return toActionResult(async () => {
    await signedInUserId();
    const supabase = await createSupabaseServer();
    // Drop half-finished setups from earlier attempts (they'd block a new one).
    const { data: factors } = await supabase.auth.mfa.listFactors();
    for (const f of factors?.all ?? []) {
      if (f.factor_type === "totp" && f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Authenticator app (${new Date().toISOString().slice(0, 10)})`,
    });
    if (error) throw new Error(error.code === "mfa_totp_enroll_not_enabled" ? "2FA isn't enabled for this app yet." : error.message);
    return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
  });
}

/** Finishes setup with the first code from the app. Turns 2FA on. */
export async function confirmTotpEnroll(factorId: string, code: string): Promise<ActionResult<true>> {
  return toActionResult(async () => {
    const userId = await signedInUserId();
    if (!CODE_RE.test(code.trim())) throw new Error("Enter the 6-digit code from your app.");
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    if (error) throw new Error("That code didn't match. Check your app and try again.");
    await query(`update users set mfa_enabled = true, updated_at = now() where id = $1`, [userId]);
    revalidatePath("/settings");
    return true as const;
  });
}

/** Turns 2FA off. Needs a current code, so a stolen session alone can't remove it. */
export async function disableTotp(code: string): Promise<ActionResult<true>> {
  return toActionResult(async () => {
    const userId = await signedInUserId();
    if (!CODE_RE.test(code.trim())) throw new Error("Enter the 6-digit code from your app.");
    const factorId = await verifiedTotpFactorId();
    if (factorId) {
      const supabase = await createSupabaseServer();
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
      if (error) throw new Error("That code didn't match. Check your app and try again.");
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
      if (unenrollError) throw new Error(unenrollError.message);
    }
    await query(`update users set mfa_enabled = false, updated_at = now() where id = $1`, [userId]);
    revalidatePath("/settings");
    return true as const;
  });
}

/** The code step at sign-in for accounts with 2FA on. */
export async function verifyLogin2fa(formData: FormData): Promise<void> {
  const next = safeNextPath(formData.get("next")?.toString());
  const code = formData.get("code")?.toString().trim() ?? "";
  const retry = (error: string) => redirect(`/login/2fa?${new URLSearchParams({ next, error })}`);

  const state = await getAuthState();
  if (state.status === "signed-out") redirect("/login");
  if (state.status === "signed-in") redirect(next);
  if (!CODE_RE.test(code)) retry("format");

  const factorId = await verifiedTotpFactorId().catch(() => null);
  if (!factorId) {
    // The flag was stale (no factor left in Supabase): nothing to verify.
    await query(`update users set mfa_enabled = false where id = $1`, [state.id]);
    redirect(next);
  }
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) retry("code");
  redirect(next);
}
