/**
 * Edge-safe auth constants and helpers (middleware imports this, so no Node
 * APIs or database access here — see lib/session.ts for those).
 */
/**
 * Sign out after this many minutes with no activity. One constant so it can
 * become a per-user setting later. Enforced in the browser (IdleSignOut) and
 * on the server (middleware, via LAST_SEEN_COOKIE) as a backstop.
 */
export const IDLE_TIMEOUT_MINUTES = 30;

/** Server-side record of the last request, for the idle timeout backstop. */
export const LAST_SEEN_COOKIE = "st_last_seen";

/**
 * The old shared password. Now only used once: whoever enters it while
 * signing up claims the data that existed before accounts.
 */
export function getAppPassword(): string | null {
  const value = process.env.APP_PASSWORD;
  return value && value.length > 0 ? value : null;
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
