"use server";

import { redirect } from "next/navigation";
import { query, queryOne, transaction } from "@/lib/db/client";
import { LEGACY_OWNER_ID } from "@/lib/db/constants";
import { getAppPassword, safeEqual, safeNextPath } from "@/lib/auth";
import { randomBytes } from "crypto";
import { endSession, getSessionUser, hashPassword, hashToken, startSession, verifyPassword } from "@/lib/session";
import { appUrl, emailConfigured, sendEmail } from "@/lib/email";
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

/** True while nobody has claimed the data that existed before accounts. */
export async function legacyDataUnclaimed(): Promise<boolean> {
  if (!getAppPassword()) return false;
  return !(await queryOne(`select 1 from users where id = $1`, [LEGACY_OWNER_ID]));
}

export async function login(formData: FormData): Promise<void> {
  const next = safeNextPath(formData.get("next")?.toString());
  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  const password = formData.get("password")?.toString() ?? "";

  const user = await queryOne<{ id: string; password_hash: string | null }>(
    `select id, password_hash from users where lower(email) = $1`,
    [email],
  );
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    // Slow down guessing — there's no per-IP lockout on serverless.
    await new Promise((r) => setTimeout(r, 1000));
    back("/login", "invalid", email, next);
  }

  await startSession(user.id);
  redirect(next);
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

  // Entering the old shared password claims everything created before
  // accounts existed: the account is created with the id those rows use.
  let id: string | null = null;
  if (legacyCode) {
    const appPassword = getAppPassword();
    if (!appPassword || !safeEqual(legacyCode, appPassword) || !(await legacyDataUnclaimed())) {
      await new Promise((r) => setTimeout(r, 1000));
      back("/signup", "legacy", email, next, rawPhone);
    }
    id = LEGACY_OWNER_ID;
  }

  const passwordHash = await hashPassword(password);
  let user: { id: string } | null;
  try {
    user = await queryOne<{ id: string }>(
      `insert into users (id, email, password_hash, phone, sms_opt_in, timezone)
       values (coalesce($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6)
       returning id`,
      [id, email, passwordHash, phone, smsOptIn, validTimeZone(timeZone)],
    );
  } catch (err) {
    if ((err as { code?: string }).code === "23505") back("/signup", "exists", email, next, rawPhone);
    throw err;
  }
  if (!user) throw new Error("Failed to create account");

  await startSession(user.id);
  redirect(next);
}

export async function logout(): Promise<void> {
  await endSession();
  redirect("/login");
}

/** Permanently deletes the signed-in user's account and every row they own. */
export async function deleteAccount(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (formData.get("confirm")?.toString().trim() !== "DELETE") redirect("/account?error=confirm");

  await transaction(async (q) => {
    for (const table of ["notifications", "activity", "person_summaries", "list_items", "tasks", "notes", "lists", "people"]) {
      await q(`delete from ${table} where user_id = $1`, [user.id]);
    }
    await q(`delete from users where id = $1`, [user.id]); // sessions cascade
  });
  await endSession();
  redirect("/signup?deleted=1");
}

const RESET_TTL_MINUTES = 60;

/**
 * Emails a one-time reset link. Always ends on the same "check your email"
 * screen, whether or not the address has an account, so the form can't be
 * used to find out who's signed up.
 */
export async function requestPasswordReset(formData: FormData): Promise<void> {
  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  if (!emailConfigured()) redirect("/login");

  const user = await queryOne<{ id: string; email: string }>(
    `select id, email from users where lower(email) = $1`,
    [email],
  );
  // At most one email a minute per account, so the form can't be used to spam someone.
  const recent =
    user &&
    (await queryOne(
      `select 1 from password_resets where user_id = $1 and created_at > now() - interval '1 minute'`,
      [user.id],
    ));

  if (user && !recent) {
    const token = randomBytes(32).toString("base64url");
    await query(`delete from password_resets where user_id = $1`, [user.id]);
    await query(
      `insert into password_resets (id, user_id, expires_at)
       values ($1, $2, now() + make_interval(mins => $3))`,
      [hashToken(token), user.id, RESET_TTL_MINUTES],
    );
    try {
      await sendEmail({
        to: user.email,
        subject: "Reset your sonderthreads password",
        text:
          `Someone asked to reset the password for this sonderthreads account.\n\n` +
          `Set a new password here (the link works once and expires in 1 hour):\n` +
          `${appUrl()}/reset-password?token=${token}\n\n` +
          `If it wasn't you, ignore this email. Your password won't change.`,
      });
    } catch (err) {
      console.error("[password reset] email failed", err);
    }
  }

  redirect("/forgot-password?sent=1");
}

/** Sets a new password from an emailed link, signs out every other device, and signs in here. */
export async function resetPassword(formData: FormData): Promise<void> {
  const token = formData.get("token")?.toString() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const retry = (error: string) => redirect(`/reset-password?${new URLSearchParams({ token, error })}`);

  if (password.length < MIN_PASSWORD_LENGTH) retry("short");

  const passwordHash = await hashPassword(password);
  const userId = await transaction(async (q) => {
    const res = (await q(
      `delete from password_resets where id = $1 and expires_at > now() returning user_id`,
      [hashToken(token)],
    )) as { rows: { user_id: string }[] };
    const id = res.rows[0]?.user_id;
    if (!id) return null;
    await q(`update users set password_hash = $1, updated_at = now() where id = $2`, [passwordHash, id]);
    await q(`delete from password_resets where user_id = $1`, [id]);
    await q(`delete from sessions where user_id = $1`, [id]);
    return id;
  });
  if (!userId) redirect("/reset-password?error=invalid");

  await startSession(userId);
  redirect("/");
}
