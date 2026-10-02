"use server";

import { redirect } from "next/navigation";
import { queryOne, transaction } from "@/lib/db/client";
import { LEGACY_OWNER_ID } from "@/lib/db/constants";
import { getAppPassword, safeEqual, safeNextPath } from "@/lib/auth";
import { endSession, getSessionUser, hashPassword, startSession, verifyPassword } from "@/lib/session";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function back(path: "/login" | "/signup", error: string, email: string, next: string): never {
  const params = new URLSearchParams({ error });
  if (email) params.set("email", email);
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

  if (!EMAIL_RE.test(email) || email.length > 254) back("/signup", "email", email, next);
  if (password.length < MIN_PASSWORD_LENGTH) back("/signup", "short", email, next);

  // Entering the old shared password claims everything created before
  // accounts existed: the account is created with the id those rows use.
  let id: string | null = null;
  if (legacyCode) {
    const appPassword = getAppPassword();
    if (!appPassword || !safeEqual(legacyCode, appPassword) || !(await legacyDataUnclaimed())) {
      await new Promise((r) => setTimeout(r, 1000));
      back("/signup", "legacy", email, next);
    }
    id = LEGACY_OWNER_ID;
  }

  const passwordHash = await hashPassword(password);
  let user: { id: string } | null;
  try {
    user = await queryOne<{ id: string }>(
      `insert into users (id, email, password_hash) values (coalesce($1::uuid, gen_random_uuid()), $2, $3)
       returning id`,
      [id, email, passwordHash],
    );
  } catch (err) {
    if ((err as { code?: string }).code === "23505") back("/signup", "exists", email, next);
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
    for (const table of ["activity", "person_summaries", "list_items", "tasks", "notes", "lists", "people"]) {
      await q(`delete from ${table} where user_id = $1`, [user.id]);
    }
    await q(`delete from users where id = $1`, [user.id]); // sessions cascade
  });
  await endSession();
  redirect("/signup?deleted=1");
}
