"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { query, queryOne, transaction } from "@/lib/db/client";
import { LEGACY_OWNER_ID } from "@/lib/db/constants";
import { getAppPassword, safeEqual, safeNextPath } from "@/lib/auth";
import { getAuthState, verifyPassword } from "@/lib/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizePhone, validTimeZone } from "@/lib/notify/phone";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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
 * preview sends links back to the preview (it must be in Supabase's
 * Redirect URLs list; see docs/auth-setup.md).
 */
async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
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
  const { error } = await createSupabaseAdmin().auth.admin.createUser({
    id: legacy.id,
    email: legacy.email,
    password,
    email_confirm: true, // they signed up before confirmation existed; don't lock them out
  });
  if (error && !/already|exists|registered/i.test(error.message)) {
    console.error("[auth] migrating account failed", error.message);
    return false;
  }
  await query(`update users set password_hash = null, updated_at = now() where id = $1`, [legacy.id]);
  return true;
}

export async function login(formData: FormData): Promise<void> {
  const next = safeNextPath(formData.get("next")?.toString());
  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  const password = formData.get("password")?.toString() ?? "";

  await migrateLegacyAccount(email, password).catch((err) => console.error("[auth] migration check failed", err));

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken: captcha(formData) },
  });
  if (error) {
    if (error.code === "email_not_confirmed") redirect(`/signup/check-email?${new URLSearchParams({ email })}`);
    if (error.code === "captcha_failed") back("/login", "captcha", email, next);
    if (error.code === "over_request_rate_limit") back("/login", "rate", email, next);
    back("/login", "invalid", email, next);
  }

  // Keep the server's "is 2FA on" flag in line with what Supabase says (trusted: straight from the auth server).
  const hasFactor = (data.user?.factors ?? []).some((f) => f.status === "verified");
  await query(`update users set mfa_enabled = $1 where id = $2`, [hasFactor, data.user.id]);
  redirect(hasFactor ? `/login/2fa?${new URLSearchParams({ next })}` : next);
}

export async function signup(formData: FormData): Promise<void> {
  const next = safeNextPath(formData.get("next")?.toString());
  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const legacyCode = formData.get("legacy")?.toString() ?? "";
  const rawPhone = formData.get("phone")?.toString().trim() ?? "";
  const phone = normalizePhone(rawPhone);
  const smsOptIn = formData.get("sms_opt_in") === "on";
  const timeZone = formData.get("timezone")?.toString() || null;

  if (!EMAIL_RE.test(email) || email.length > 254) back("/signup", "email", email, next, rawPhone);
  if (!phone) back("/signup", "phone", email, next, rawPhone);
  if (password.length < MIN_PASSWORD_LENGTH) back("/signup", "short", email, next, rawPhone);
  if (await queryOne(`select 1 from users where lower(email) = $1`, [email])) {
    back("/signup", "exists", email, next, rawPhone);
  }

  const emailRedirectTo = `${await origin()}/auth/confirm?${new URLSearchParams({ next })}`;
  let userId: string;

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
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo, captchaToken: captcha(formData) },
    });
    if (error) {
      if (error.code === "captcha_failed") back("/signup", "captcha", email, next, rawPhone);
      if (error.code === "weak_password") back("/signup", "weak", email, next, rawPhone);
      if (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") back("/signup", "rate", email, next, rawPhone);
      console.error("[auth] sign-up failed", error.message);
      back("/signup", "failed", email, next, rawPhone);
    }
    // Supabase hides whether an email is already registered (empty identities); treat it as sent.
    if (!data.user || data.user.identities?.length === 0) redirect(`/signup/check-email?${new URLSearchParams({ email })}`);
    userId = data.user.id;
    if (data.session) {
      // Email confirmation is off in Supabase: they're signed in already.
      await createUserRow(userId, email, phone, smsOptIn, timeZone);
      redirect(next);
    }
  }

  await createUserRow(userId, email, phone, smsOptIn, timeZone);
  redirect(`/signup/check-email?${new URLSearchParams({ email })}`);
}

async function createUserRow(id: string, email: string, phone: string | null, smsOptIn: boolean, timeZone: string | null) {
  await query(
    `insert into users (id, email, phone, sms_opt_in, timezone) values ($1, $2, $3, $4, $5)
     on conflict (id) do update set phone = excluded.phone, sms_opt_in = excluded.sms_opt_in, timezone = excluded.timezone`,
    [id, email, phone, smsOptIn, validTimeZone(timeZone)],
  );
}

export async function logout(): Promise<void> {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Signs out after inactivity (called by the browser's idle timer). */
export async function idleSignOut(): Promise<void> {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/login?reason=idle");
}

/** Permanently deletes the signed-in user's account and every row they own. */
export async function deleteAccount(formData: FormData): Promise<void> {
  const state = await getAuthState();
  if (state.status !== "signed-in") redirect("/login");
  const user = state.user;
  if (formData.get("confirm")?.toString().trim() !== "DELETE") redirect("/account?error=confirm");

  await transaction(async (q) => {
    for (const table of ["notifications", "activity", "person_summaries", "list_items", "tasks", "notes", "lists", "people"]) {
      await q(`delete from ${table} where user_id = $1`, [user.id]);
    }
    await q(`delete from users where id = $1`, [user.id]); // sessions, push subscriptions cascade
  });
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/signup?deleted=1");
}
