import { cache } from "react";
import { cookies, headers } from "next/headers";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { query, queryOne } from "@/lib/db/client";
import { SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
}

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

/** "scrypt$<salt>$<hash>", both base64url. Node's built-in scrypt, no dependency. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  const [scheme, salt, hash] = (stored ?? "").split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scryptAsync(password, Buffer.from(salt, "base64url"), expected.length);
  return timingSafeEqual(actual, expected);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Session token from the cookie (web) or an Authorization: Bearer header (native apps). */
async function readToken(): Promise<string | null> {
  const auth = (await headers()).get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim() || null;
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

/** The signed-in user, or null. Cached so many queries in one request share one lookup. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = await readToken();
  if (!token) return null;
  return queryOne<SessionUser>(
    `select u.id, u.email, u.name
       from sessions s join users u on u.id = s.user_id
      where s.id = $1 and s.expires_at > now()`,
    [hashToken(token)],
  );
});

/** Creates a session and sets the cookie. Only callable from a Server Action or Route Handler. */
export async function startSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  await query(`delete from sessions where user_id = $1 and expires_at < now()`, [userId]);
  await query(
    `insert into sessions (id, user_id, expires_at) values ($1, $2, now() + make_interval(secs => $3))`,
    [hashToken(token), userId, SESSION_MAX_AGE],
  );
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function endSession(): Promise<void> {
  const token = await readToken();
  if (token) await query(`delete from sessions where id = $1`, [hashToken(token)]);
  (await cookies()).delete(SESSION_COOKIE);
}
