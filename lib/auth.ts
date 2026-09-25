/**
 * Single-password gate. The session cookie holds an HMAC of a fixed string
 * keyed by APP_PASSWORD, so it can't be forged without the password, and
 * changing APP_PASSWORD signs everyone out. Uses Web Crypto only so the same
 * code runs in middleware (Edge) and in server actions (Node).
 *
 * This is a stopgap until real per-user accounts exist.
 */
export const SESSION_COOKIE = "st_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function getAppPassword(): string | null {
  const value = process.env.APP_PASSWORD;
  return value && value.length > 0 ? value : null;
}

export async function sessionToken(password: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("sonderthreads-session-v1"));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compares without bailing out at the first mismatch, so response time doesn't leak how much matched. */
export function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/** Only allow redirecting back to a path on this site. */
export function safeNextPath(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
