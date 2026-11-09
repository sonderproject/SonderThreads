/**
 * Edge-safe auth constants and helpers (middleware imports this, so no Node
 * APIs or database access here — see lib/session.ts for those).
 */
/**
 * Default sign-out after this many minutes with no activity; each person can
 * pick 15, 30 or 60 in Settings (user_settings.idle_timeout_minutes). Enforced in the browser (IdleSignOut) and
 * on the server (middleware, via LAST_SEEN_COOKIE) as a backstop.
 */
export const IDLE_TIMEOUT_MINUTES = 30;

/** The user's chosen timeout (Settings → Privacy & security), for the middleware backstop. */
export const IDLE_MINUTES_COOKIE = "st_idle_minutes";

/** Allowed timeouts; anything else (or no cookie) means the default. Keep in sync with lib/settings-options.ts. */
export function idleMinutesFrom(value: string | number | undefined | null): number {
  const n = Number(value);
  return n === 15 || n === 30 || n === 60 ? n : IDLE_TIMEOUT_MINUTES;
}

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
