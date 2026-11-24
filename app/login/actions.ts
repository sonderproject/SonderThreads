"use server";

import { recordMarketingChoice } from "@/lib/marketing";
import { isEmailSendError, sendAuthEmail } from "@/lib/auth-emails";

import { isEmail } from "@/lib/email-check";
import { readDraft, saveDraftToAccount, setupFlowFor } from "@/lib/setup";
import { markOrgAgreed } from "@/lib/actions/setup";
import { recordAcceptance } from "@/lib/legal-server";
import { cookies, headers } from "next/headers";
import { FRIEND_COOKIE, applyFriendsCode, checkFriendsCode } from "@/lib/friends";
import { alertOwner, isLikelyBot, logEvent } from "@/lib/events";
import { redirect } from "next/navigation";
import { query, queryOne, transaction } from "@/lib/db/client";
import { LEGACY_OWNER_ID } from "@/lib/db/constants";
import { LAST_SEEN_COOKIE, getAppPassword, safeEqual, safeNextPath } from "@/lib/auth";
import { getAuthState, hashToken, verifyPassword } from "@/lib/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizePhone, validTimeZone } from "@/lib/notify/phone";
import { phoneTaken } from "@/lib/phone-unique";
import { otherActiveAdmin, transferOrgClients } from "@/lib/org-admin";

const MIN_PASSWORD_LENGTH = 8;

function back(
  path: "/login" | "/signup" | "/reset-password",
  error: string,
  email: string,
  next: string,
  phone = "",
): never {
  const params = new URLSearchParams({ error });
  if (email) params.set("email", email);
  if (phone) params.set("phone", phone);
  if (next !== "/") params.set("next", next);
  redirect(`${path}?${params}`);
}

/**
 * This deployment's own origin, for links in auth emails, so a Vercel
 * preview sends links back to the preview. Every auth email's redirect is
 * `<origin>/auth/confirm?next=...` (always with a "?"), because the email
 * templates append `&token_hash=...&type=...` to {{ .RedirectTo }}. The
 * origin must be in Supabase's Redirect URLs list (docs/auth-setup.md).
 */
async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

/**
 * Sign-in when the CAPTCHA can't run (e.g. Cloudflare doesn't allow this web address yet):
 * Supabase Auth skips the CAPTCHA for requests made with the server's service key, and still
 * checks the password. Limited to 5 tries per email per 15 minutes and 20 per network per hour,
 * so it can't be used to guess passwords; the owner is emailed when it's used.
 * Returns the session, null (wrong password or unconfirmed email) or "limited".
 */
async function signInWithoutCheck(email: string, password: string) {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const tries = await queryOne<{ by_email: number; by_ip: number }>(
    `select count(*) filter (where email = $1 and created_at > now() - interval '15 minutes')::int as by_email,
            count(*) filter (where meta->>'ip' = $2)::int as by_ip
       from app_events where kind = 'auth.login_without_check' and created_at > now() - interval '1 hour'`,
    [email, ip],
  );
  if ((tries?.by_email ?? 0) >= 5 || (tries?.by_ip ?? 0) >= 20) return "limited" as const;
  const { data, error } = await createSupabaseAdmin().auth.signInWithPassword({ email, password });
  await logEvent("auth.login_without_check", error ? `Sign-in without the security check failed (${error.code ?? "error"})` : "Signed in without the security check", {
    level: "warn",
    email,
    path: "/login",
    meta: { ip, ok: !error },
  });
  if (error || !data.session) return null;
  await alertOwner(
    "Sign-ins are skipping the security check",
    [
      "The Cloudflare Turnstile check isn't working on the sign-in page, so people are signed in through the server instead (attempt limits still apply).",
      "Fix: in Cloudflare → Turnstile → your widget → Hostname Management, add thesurfdesk.app, and make sure that widget's secret key is the one in Supabase → Authentication → Attack Protection.",
    ],
    { everyMinutes: 360 },
  );
  return data.session;
}

/**
 * Sign-up, resend-confirmation and password-reset backup for when the CAPTCHA can't run (same
 * approach as signInWithoutCheck, approved by the owner Nov 15, 2026): the request goes through
 * the server's service key, which Supabase exempts from CAPTCHA. Tight limits per network
 * (sign-up: 3 an hour) and per email (2 an hour), every use logged, owner emailed.
 */
async function allowWithoutCheck(kind: "signup" | "resend" | "reset", email: string): Promise<boolean> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const perIp = kind === "signup" ? 3 : 5;
  const tries = await queryOne<{ by_ip: number; by_email: number }>(
    `select count(*) filter (where meta->>'ip' = $1 and meta->>'kind' = $3)::int as by_ip,
            count(*) filter (where email = $2 and meta->>'kind' = $3)::int as by_email
       from app_events where kind = 'auth.without_check' and created_at > now() - interval '1 hour'`,
    [ip, email, kind],
  );
  if ((tries?.by_ip ?? 0) >= perIp || (tries?.by_email ?? 0) >= 2) return false;
  await logEvent("auth.without_check", `${kind} without the security check`, { level: "warn", email, path: `/${kind}`, meta: { ip, kind } });
  await alertOwner(
    "Sign-ups are skipping the security check",
    [
      "The Cloudflare Turnstile check isn't working, so sign-ups and password resets go through the server instead (limited to a few per network an hour).",
      "Fix: in Cloudflare → Turnstile → your widget → Hostname Management, add thesurfdesk.app.",
    ],
    { everyMinutes: 360 },
  );
  return true;
}

/** Supabase refused the security-check token: record it, and email the owner if it keeps happening. */
async function captchaFailed(path: string, email: string): Promise<void> {
  await logEvent("auth.captcha_failed", "Security check token was refused", { level: "warn", email, path });
  const recent = await queryOne<{ n: number }>(
    `select count(*)::int as n from app_events where kind = 'auth.captcha_failed' and created_at > now() - interval '30 minutes'`,
  ).catch(() => null);
  if ((recent?.n ?? 0) >= 3) {
    await alertOwner("People are failing the sign-in security check", [
      `${recent!.n} sign-in or sign-up attempts in the last 30 minutes failed the security check.`,
      "Check the Turnstile widget's hostnames in Cloudflare (thesurfdesk.app must be listed) and that its secret matches Supabase's CAPTCHA setting.",
    ], { everyMinutes: 60 });
  }
}

function captcha(formData: FormData): string | undefined {
  return formData.get("captcha_token")?.toString() || undefined;
}

/** True while nobody has claimed the data that existed before accounts. */
export async function legacyDataUnclaimed(): Promise<boolean> {
  if (!getAppPassword()) return false;
  return !(await queryOne(`select 1 from users where id = $1`, [LEGACY_OWNER_ID]));
}

/**
 * Accounts created before the move to Supabase Auth have their password in
 * users.password_hash (scrypt, which Supabase can't import). The first time
 * one signs in, check that password here; if it's right, create the
 * Supabase user with the same id (so all their data stays theirs), the same
 * password, and the email already confirmed, then clear the old hash. After
 * that it's an ordinary Supabase account. Returns true if it migrated one.
 */
async function migrateLegacyAccount(email: string, password: string): Promise<boolean> {
  const legacy = await queryOne<{ id: string; email: string; password_hash: string }>(
    `select id, email, password_hash from users where lower(email) = $1 and password_hash is not null`,
    [email],
  );
  if (!legacy || !(await verifyPassword(password, legacy.password_hash))) return false;
  const admin = createSupabaseAdmin().auth.admin;
  const { error } = await admin.createUser({
    id: legacy.id,
    email: legacy.email,
    password,
    email_confirm: true, // they signed up before confirmation existed; don't lock them out
  });
  if (error) {
    // Already created by a password-reset request: set the password they just proved.
    const { error: updateError } = await admin.updateUserById(legacy.id, { password, email_confirm: true });
    if (updateError) {
      console.error("[auth] migrating account failed", error.message, updateError.message);
      return false;
    }
  }
  await query(`update users set password_hash = null, updated_at = now() where id = $1`, [legacy.id]);
  return true;
}

/**
 * Makes sure a pre-Supabase account has a Supabase user (same id, email
 * confirmed) so a reset email can be sent to it. Its old password keeps
 * working until a new one is set.
 */
async function ensureSupabaseUser(email: string): Promise<void> {
  const legacy = await queryOne<{ id: string; email: string }>(
    `select id, email from users where lower(email) = $1 and password_hash is not null`,
    [email],
  );
  if (!legacy) return;
  const { error } = await createSupabaseAdmin().auth.admin.createUser({ id: legacy.id, email: legacy.email, email_confirm: true });
  if (error && error.code !== "email_exists" && error.code !== "user_already_exists") {
    console.error("[auth] preparing account for reset failed", error.message);
  }
}

/**
 * "Forgot password?": Supabase emails a reset link. Always ends on the same
 * "check your email" message, so the form can't be used to find out who has
 * an account; Supabase limits how often it sends.
 */
export async function requestPasswordReset(formData: FormData): Promise<void> {
  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  if (!isEmail(email)) redirect("/forgot-password?error=email");
  await ensureSupabaseUser(email).catch((err) => console.error("[auth] reset prep failed", err));
  const supabase = await createSupabaseServer();
  const redirectTo = `${await origin()}/auth/confirm?next=%2Freset-password`;
  let { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo, captchaToken: captcha(formData) });
  // Security check couldn't run (limited backup) or Supabase couldn't send the email: the app sends it.
  if (error?.code === "captcha_failed" || isEmailSendError(error)) {
    if (error?.code === "captcha_failed" && !(await allowWithoutCheck("reset", email))) redirect("/forgot-password?error=captcha");
    const sent = await sendAuthEmail("recovery", email, { next: "/reset-password" });
    error = null;
    if (sent.status === "failed") console.error("[auth] reset email (app) failed");
  }
  if (error && error.status !== 429) console.error("[auth] reset email failed", error.code ?? error.message);
  redirect("/forgot-password?sent=1");
}

/** Sets a new password. The session comes from the emailed link (/auth/confirm, type=recovery). */
export async function resetPassword(formData: FormData): Promise<void> {
  const password = formData.get("password")?.toString() ?? "";
  const confirm = formData.get("confirm")?.toString() ?? "";
  if (password.length < MIN_PASSWORD_LENGTH) redirect("/reset-password?error=short");
  if (password !== confirm) redirect("/reset-password?error=match");

  const state = await getAuthState();
  if (state.status === "signed-out") redirect("/reset-password?error=invalid");
  if (state.status === "needs-2fa") redirect("/login/2fa?next=/reset-password");
  if (state.status !== "signed-in") redirect(state.status === "suspended" ? "/suspended" : "/maintenance");

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "weak_password") redirect("/reset-password?error=weak");
    if (error.code === "same_password") redirect("/reset-password?error=same");
    console.error("[auth] setting new password failed", error.code ?? error.message);
    redirect("/reset-password?error=failed");
  }
  // The old pre-Supabase password (if any) must stop working too, and other devices are signed out.
  await query(`update users set password_hash = null, updated_at = now() where id = $1`, [state.user.id]);
  await supabase.auth.signOut({ scope: "others" });
  redirect("/");
}

export async function login(formData: FormData): Promise<void> {
  const next = safeNextPath(formData.get("next")?.toString());
  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  const password = formData.get("password")?.toString() ?? "";

  await migrateLegacyAccount(email, password).catch((err) => console.error("[auth] migration check failed", err));

  const supabase = await createSupabaseServer();
  let { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken: captcha(formData) },
  });
  // The security check couldn't run in their browser (or its token was refused). Approved by the
  // owner (Nov 15, 2026): never lock people out over that; sign in through the server instead,
  // under strict attempt limits (signInWithoutCheck).
  if (error?.code === "captcha_failed") {
    await captchaFailed("/login", email);
    const fallback = await signInWithoutCheck(email, password);
    if (fallback === "limited") back("/login", "rate", email, next);
    if (fallback) {
      const set = await supabase.auth.setSession({ access_token: fallback.access_token, refresh_token: fallback.refresh_token });
      data = { user: fallback.user, session: set.data.session } as typeof data;
      error = set.error;
    } else {
      back("/login", "invalid", email, next);
    }
  }
  if (error) {
    if (error.code === "email_not_confirmed") redirect(`/signup/check-email?${new URLSearchParams({ email, next })}`);
    if (error.code === "over_request_rate_limit") back("/login", "rate", email, next);
    back("/login", "invalid", email, next);
  }

  if (!data.user) back("/login", "invalid", email, next);
  // Keep the server's "is 2FA on" flag in line with what Supabase says (trusted: straight from the auth server).
  const hasFactor = (data.user!.factors ?? []).some((f) => f.status === "verified");
  await query(`update users set mfa_enabled = $1 where id = $2`, [hasFactor, data.user!.id]);
  redirect(hasFactor ? `/login/2fa?${new URLSearchParams({ next })}` : next);
}

export async function signup(formData: FormData): Promise<void> {
  const next = safeNextPath(formData.get("next")?.toString());
  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const legacyCode = formData.get("legacy")?.toString() ?? "";
  const rawPhone = formData.get("phone")?.toString().trim() ?? "";
  const phone = normalizePhone(rawPhone);
  // Optional; text reminders need one.
  const smsOptIn = formData.get("sms_opt_in") === "on" && Boolean(rawPhone);
  const timeZone = formData.get("timezone")?.toString() || null;
  const agreed = formData.get("agree") === "on";
  // Optional and unchecked by default (lib/marketing.ts); recorded with the exact wording shown.
  const marketing = formData.get("marketing_opt_in") === "on";
  // Friends & family link (lib/friends.ts): checked on the server with guess limits, and kept
  // in a cookie so a retry after an error still counts.
  const cookieJar = await cookies();
  const friend = formData.get("friend")?.toString().trim() || cookieJar.get(FRIEND_COOKIE)?.value || "";
  const friendOk = friend ? await checkFriendsCode(friend) : false;
  if (friend && !friendOk) {
    cookieJar.delete(FRIEND_COOKIE);
    // Came from the link but it's wrong, retired or blocked: say so instead of starting a paid trial.
    if (formData.get("friend")) {
      await new Promise((r) => setTimeout(r, 1000));
      back("/signup", "friend", email, next, rawPhone);
    }
  }
  if (friendOk) {
    cookieJar.set(FRIEND_COOKIE, friend, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 7 * 86_400 });
  }
  const makeFriendFree = async (id: string) => {
    if (!friendOk) return;
    await applyFriendsCode(id, email);
    cookieJar.delete(FRIEND_COOKIE);
  };

  if (!agreed) back("/signup", "agree", email, next, rawPhone);
  // Organization set-up: the sign-up checkbox carries the organization agreement too (app/signup/page.tsx).
  if (setupFlowFor(next) === "org") await markOrgAgreed();
  if (!isEmail(email) || email.length > 254) back("/signup", "email", email, next, rawPhone);
  if (rawPhone && !phone) back("/signup", "phone", email, next, rawPhone);
  if (phone && (await phoneTaken(phone))) back("/signup", "phone-used", email, next, rawPhone);
  if (password.length < MIN_PASSWORD_LENGTH) back("/signup", "short", email, next, rawPhone);
  if (await queryOne(`select 1 from users where lower(email) = $1`, [email])) {
    back("/signup", "exists", email, next, rawPhone);
  }

  const emailRedirectTo = `${await origin()}/auth/confirm?${new URLSearchParams({ next })}`;
  let userId: string;

  // Signing up from an organization invite link: the link (sent by the admin,
  // by email or text) proves this person got the invite, so skip the
  // confirmation email, which work inboxes often hold back, and sign them in.
  const inviteToken = next.match(/^\/join\/([A-Za-z0-9_-]{20,})$/)?.[1];
  if (inviteToken && !legacyCode) {
    const invite = await queryOne<{ email: string }>(
      `select email from invitations where token_hash = $1 and accepted_at is null and expires_at > now()`,
      [hashToken(inviteToken)],
    );
    if (invite && invite.email.toLowerCase() === email) {
      const { data, error } = await createSupabaseAdmin().auth.admin.createUser({ email, password, email_confirm: true });
      if (error || !data.user) {
        console.error("[auth] invite sign-up failed", error?.message);
        back("/signup", "failed", email, next, rawPhone);
      }
      await createUserRow(data.user!.id, email, phone, smsOptIn, timeZone, marketing);
      await makeFriendFree(data.user!.id);
      const supabase = await createSupabaseServer();
      const signedIn = await supabase.auth.signInWithPassword({ email, password, options: { captchaToken: captcha(formData) } });
      if (signedIn.error?.code === "captcha_failed") {
        const s = await signInWithoutCheck(email, password);
        if (s && s !== "limited") await supabase.auth.setSession({ access_token: s.access_token, refresh_token: s.refresh_token });
      }
      redirect(next);
    }
  }

  if (legacyCode) {
    // Entering the old shared password claims everything created before
    // accounts existed: the account is created with the id those rows use.
    const appPassword = getAppPassword();
    if (!appPassword || !safeEqual(legacyCode, appPassword) || !(await legacyDataUnclaimed())) {
      await new Promise((r) => setTimeout(r, 1000));
      back("/signup", "legacy", email, next, rawPhone);
    }
    const { error } = await createSupabaseAdmin().auth.admin.createUser({ id: LEGACY_OWNER_ID, email, password });
    if (error) back("/signup", "failed", email, next, rawPhone);
    userId = LEGACY_OWNER_ID;
    const supabase = await createSupabaseServer();
    await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo, captchaToken: captcha(formData) } });
  } else {
    const supabase = await createSupabaseServer();
    let { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo, captchaToken: captcha(formData) },
    });
    // Security check couldn't run (limited backup, see allowWithoutCheck), or Supabase couldn't send its
    // confirmation email: create the account through the server and send the email from the app.
    let viaApp = false;
    if (error?.code === "captcha_failed") {
      await captchaFailed("/signup", email);
      if (!(await allowWithoutCheck("signup", email))) back("/signup", "captcha", email, next, rawPhone);
      viaApp = true;
    } else if (isEmailSendError(error)) {
      viaApp = true;
    }
    if (viaApp) {
      const sent = await sendAuthEmail("signup", email, { password, next });
      // Already registered: same answer as Supabase gives (never reveal who has an account).
      if (sent.status === "exists") redirect(`/signup/check-email?${new URLSearchParams({ email, next })}`);
      if (sent.status === "sent" && sent.user) {
        data = { user: sent.user, session: null } as typeof data;
        error = null;
      } else {
        back("/signup", "failed", email, next, rawPhone);
      }
    }
    if (error) {
      if (error.code === "captcha_failed") back("/signup", "captcha", email, next, rawPhone);
      if (error.code === "weak_password") back("/signup", "weak", email, next, rawPhone);
      if (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") back("/signup", "rate", email, next, rawPhone);
      console.error("[auth] sign-up failed", error.message);
      await logEvent("auth.signup_failed", error.message, { level: "error", email, path: "/signup", meta: { code: error.code ?? null } });
      back("/signup", "failed", email, next, rawPhone);
    }
    // Supabase hides whether an email is already registered (empty identities); treat it as sent.
    if (!data.user || data.user.identities?.length === 0) redirect(`/signup/check-email?${new URLSearchParams({ email, next })}`);
    userId = data.user.id;
    if (data.session) {
      // Email confirmation is off in Supabase: they're signed in already.
      await createUserRow(userId, email, phone, smsOptIn, timeZone, marketing);
      await makeFriendFree(userId);
      redirect(next);
    }
  }

  await createUserRow(userId, email, phone, smsOptIn, timeZone, marketing);
  await makeFriendFree(userId);
  // Guided set-up: keep the answers on the account too, for a confirmation link opened on another device.
  if (setupFlowFor(next)) await saveDraftToAccount(userId).catch((err) => console.error("[setup] saving answers failed", err));
  const source = Object.fromEntries(
    ["utm_source", "utm_medium", "utm_campaign", "utm_content"]
      .map((k) => [k, formData.get(k)?.toString().trim().slice(0, 80) || null])
      .filter(([, v]) => v),
  );
  // Which guided set-up this sign-up came from (owner's drop-off view).
  const flow = setupFlowFor(next);
  const fid = flow ? (await readDraft())?.fid : undefined;
  await logEvent("auth.signup", isLikelyBot(email) ? "New sign-up (likely bot)" : "New sign-up", {
    email,
    path: "/signup",
    meta: { ...source, ...(flow ? { flow, fid: fid ?? null } : {}), device: await deviceKind() },
  });
  redirect(`/signup/check-email?${new URLSearchParams({ email, next })}`);
}

/** Sign-up always requires ticking "I agree", so every new row records that agreement. */
async function createUserRow(id: string, email: string, phone: string | null, smsOptIn: boolean, timeZone: string | null, marketing: boolean) {
  await query(
    `insert into users (id, email, phone, sms_opt_in, timezone) values ($1, $2, $3, $4, $5)
     on conflict (id) do update set phone = excluded.phone, sms_opt_in = excluded.sms_opt_in, timezone = excluded.timezone`,
    [id, email, phone, smsOptIn, validTimeZone(timeZone)],
  );
  await recordAcceptance(id, "user");
  if (marketing) await recordMarketingChoice(id, true, "signup").catch((err) => console.error("[auth] marketing opt-in not saved", err));
}

/**
 * Sends the sign-up confirmation email again. Always lands on the same
 * screen (whether or not the address is registered) so it can't be used to
 * find out who has an account; Supabase limits how often it sends.
 */
export async function resendConfirmation(formData: FormData): Promise<void> {
  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  // Keep where they were headed (e.g. the guided set-up), so the new email's link and code continue there.
  const next = safeNextPath(formData.get("next")?.toString());
  const params = new URLSearchParams({ email, next });
  if (!isEmail(email)) redirect(`/signup/check-email?${params}`);
  const supabase = await createSupabaseServer();
  const emailRedirectTo = `${await origin()}/auth/confirm?${new URLSearchParams({ next })}`;
  let { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo, captchaToken: captcha(formData) } });
  if ((error?.code === "captcha_failed" && (await allowWithoutCheck("resend", email))) || isEmailSendError(error)) {
    const sent = await sendAuthEmail("resend", email, { next });
    error = sent.status === "failed" ? error : null;
  }
  if (error?.code === "captcha_failed") params.set("error", "captcha");
  else if (error?.code === "over_email_send_rate_limit" || error?.code === "over_request_rate_limit" || error?.status === 429) {
    params.set("error", "rate");
  } else params.set("resent", "1");
  redirect(`/signup/check-email?${params}`);
}

export async function logout(): Promise<void> {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  (await cookies()).delete(LAST_SEEN_COOKIE);
  redirect("/login");
}

/** Settings → Account: signs this account out on every device (all sessions). */
export async function signOutEverywhere(): Promise<void> {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut({ scope: "global" });
  (await cookies()).delete(LAST_SEEN_COOKIE);
  redirect("/login?reason=everywhere");
}

/**
 * Settings → Account: change the sign-in email. Supabase emails a
 * confirmation link (to both the old and new address, with its "secure email
 * change" setting on); the change applies once confirmed. The app's
 * users.email follows the next session refresh (lib/session.ts).
 */
export async function requestEmailChange(formData: FormData): Promise<void> {
  const state = await getAuthState();
  if (state.status !== "signed-in") redirect("/login");
  const email = (formData.get("email")?.toString() ?? "").trim().toLowerCase();
  if (!isEmail(email)) redirect("/settings?error=email-invalid#email");
  if (email === state.user.email.toLowerCase()) redirect("/settings?error=email-same#email");
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.updateUser(
    { email },
    { emailRedirectTo: `${await origin()}/auth/confirm?${new URLSearchParams({ next: "/settings?email=confirmed#email" })}` },
  );
  if (error) {
    console.error("[auth] email change failed", error.code ?? error.message);
    const code =
      error.code === "email_exists" ? "email-taken" : error.code === "over_email_send_rate_limit" ? "email-rate" : "email-failed";
    redirect(`/settings?error=${code}#email`);
  }
  redirect("/settings?email=sent#email");
}

/** Signs out after inactivity (called by the browser's idle timer). */
export async function idleSignOut(): Promise<void> {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  (await cookies()).delete(LAST_SEEN_COOKIE);
  redirect("/login?reason=idle");
}

/** Every table holding a user's rows, children before parents. */
const USER_TABLES = [
  "notifications",
  "activity",
  "person_summaries",
  "check_ins",
  "list_items",
  "tasks",
  "notes",
  "lists",
  "people",
  "push_subscriptions",
  "user_settings",
  "memberships",
  "password_resets",
  "sessions",
] as const;

/**
 * Permanently deletes the signed-in user's account: all their data in one
 * transaction, then their Supabase login via the server-only admin API.
 * Data goes first so that if the second step fails nothing personal is left
 * (deleting again finishes the job). Requires a fully signed-in session (2FA
 * passed if it's on) and typing DELETE.
 */
export async function deleteAccount(formData: FormData): Promise<void> {
  const state = await getAuthState();
  if (state.status === "needs-2fa") redirect("/login/2fa?next=/settings");
  if (state.status !== "signed-in") redirect("/login");
  const user = state.user;
  if (formData.get("confirm")?.toString().trim() !== "DELETE") redirect("/settings?error=confirm#delete");

  // An organization's clients outlive a member who leaves: they go to another
  // admin. If others remain but no other admin does, they must name one first.
  const membership = await queryOne<{ org_id: string; others: number }>(
    `select m.org_id, (select count(*)::int from memberships o where o.org_id = m.org_id and o.active and o.user_id <> m.user_id) as others
       from memberships m where m.user_id = $1 and m.active`,
    [user.id],
  );
  const heir = membership && membership.others > 0 ? await otherActiveAdmin(membership.org_id, user.id) : null;
  if (membership && membership.others > 0 && !heir) redirect("/settings?error=last-admin#delete");

  await transaction(async (q) => {
    if (membership && heir) await transferOrgClients(q, membership.org_id, user.id, heir);
    for (const table of USER_TABLES) await q(`delete from ${table} where user_id = $1`, [user.id]);
    await q(`delete from users where id = $1`, [user.id]);
    // The last member out takes the (now empty) organization with them.
    if (membership && membership.others === 0) {
      await q(`delete from organizations o where o.id = $1 and not exists (select 1 from memberships where org_id = o.id and active)`, [
        membership.org_id,
      ]);
    }
  });

  const { error } = await createSupabaseAdmin().auth.admin.deleteUser(user.id);
  if (error && error.code !== "user_not_found") {
    console.error("[auth] data deleted but removing the login failed", error.message);
    redirect("/settings?error=delete-login#delete");
  }
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/signup?deleted=1");
}

/**
 * The 6-digit code from the confirmation email, typed on the "Check your email"
 * screen: the same check as tapping the email's button, without leaving the app.
 */
export async function verifySignupCode(formData: FormData): Promise<void> {
  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  const code = (formData.get("code")?.toString() ?? "").replace(/\s/g, "");
  const next = safeNextPath(formData.get("next")?.toString());
  const back = (error: string) => redirect(`/signup/check-email?${new URLSearchParams({ email, next, error })}`);
  if (!isEmail(email)) back("code-email");
  if (!/^\d{6,10}$/.test(code)) back("code");
  const supabase = await createSupabaseServer();
  // Newer Supabase accepts sign-up codes as "email"; older projects as "signup".
  let { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  if (error) ({ error } = await supabase.auth.verifyOtp({ email, token: code, type: "signup" }));
  if (error) {
    await logEvent("auth.code_failed", `Sign-up code didn't work: ${error.code ?? error.message}`, { level: "warn", email, path: "/signup/check-email" });
    back(error.code === "otp_expired" ? "code-expired" : "code");
  }
  redirect(next);
}

/** Phone, tablet or computer, from the browser's user agent (owner audience numbers; nothing else is kept). */
async function deviceKind(): Promise<"phone" | "tablet" | "computer"> {
  const ua = (await headers()).get("user-agent") ?? "";
  if (/iPad|Tablet|(Android(?!.*Mobile))/i.test(ua)) return "tablet";
  if (/Mobi|iPhone|Android/i.test(ua)) return "phone";
  return "computer";
}
