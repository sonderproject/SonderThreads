import { cache } from "react";
import { headers } from "next/headers";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { queryOne } from "@/lib/db/client";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * Who is signed in. Identity comes from Supabase Auth (its session cookies,
 * or an `Authorization: Bearer <access token>` header for native apps); the
 * app's own `users` row has the same id as the Supabase user, so every
 * existing query keyed by user_id keeps working.
 */
export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
}

export type AuthState =
  | { status: "signed-out" }
  /** Password accepted, but the account has 2FA on and this session hasn't passed it yet. */
  | { status: "needs-2fa"; id: string; email: string }
  | { status: "signed-in"; user: SessionUser };

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

/** Pre-Supabase password format ("scrypt$<salt>$<hash>"); kept only to migrate those accounts. */
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

async function bearerToken(): Promise<string | undefined> {
  const auth = (await headers()).get("authorization");
  return auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() || undefined : undefined;
}

/**
 * The verified auth state for this request (cached per request). getClaims()
 * verifies the access token's signature, so a tampered cookie can't pass.
 * Whether 2FA is required comes from the app's own users.mfa_enabled (set
 * only by the server when a factor is verified or removed), never from the
 * cookie, so it can't be skipped by editing the client's session.
 */
export const getAuthState = cache(async (): Promise<AuthState> => {
  type Claims = { sub?: string; email?: string; aal?: string };
  let claims: Claims | null = null;
  try {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase.auth.getClaims(await bearerToken());
    if (!error && data?.claims) claims = data.claims as unknown as Claims;
  } catch (err) {
    console.error("[auth] couldn't read session", err instanceof Error ? err.message : err);
    return { status: "signed-out" };
  }
  if (!claims?.sub) return { status: "signed-out" };

  type Row = { id: string; email: string; name: string | null; mfa_enabled: boolean };
  let row = await queryOne<Row>(`select id, email, name, mfa_enabled from users where id = $1`, [claims.sub]);
  // First request after confirming a new sign-up: create the app's row (same id as Supabase's).
  row ??= await queryOne<Row>(
    `insert into users (id, email) values ($1, $2)
     on conflict (id) do update set email = users.email
     returning id, email, name, mfa_enabled`,
    [claims.sub, (claims.email ?? "").toLowerCase()],
  );
  if (!row) return { status: "signed-out" };
  // A confirmed email change reaches the app through the refreshed session.
  const claimedEmail = (claims.email ?? "").toLowerCase();
  if (claimedEmail && claimedEmail !== row.email) {
    await queryOne(`update users set email = $1, updated_at = now() where id = $2 returning id`, [claimedEmail, row.id])
      .then(() => { row.email = claimedEmail; })
      .catch((err) => console.error("[auth] couldn't sync changed email", err instanceof Error ? err.message : err));
  }
  if (row.mfa_enabled && claims.aal !== "aal2") return { status: "needs-2fa", id: row.id, email: row.email };
  return { status: "signed-in", user: { id: row.id, email: row.email, name: row.name } };
});

/** The fully signed-in user (2FA passed if it's on), or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const state = await getAuthState();
  return state.status === "signed-in" ? state.user : null;
}
