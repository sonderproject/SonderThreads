import { IDLE_TIMEOUT_OPTIONS } from "@/lib/settings-options";

/**
 * Edge-safe auth constants and helpers (middleware imports this, so no Node
 * APIs or database access here — see lib/session.ts for those).
 */
/**
 * Default sign-out after this many minutes with no activity; each person can
 * pick 5 minutes to 8 hours, or stay signed in, in Settings (user_settings). Enforced in the browser (IdleSignOut) and
 * on the server (middleware, via LAST_SEEN_COOKIE) as a backstop.
 */
export const IDLE_TIMEOUT_MINUTES = 30;

/** The user's chosen timeout (Settings → Privacy & security), for the middleware backstop. */
export const IDLE_MINUTES_COOKIE = "st_idle_minutes";

/** The cookie value meaning "stay signed in" (no idle sign-out). */
export const STAY_SIGNED_IN = "0";

/**
 * The idle limit from the cookie: null = stay signed in; an allowed preset;
 * anything else (or no cookie) = the default.
 */
export function idleMinutesFrom(value: string | number | undefined | null): number | null {
  if (String(value) === STAY_SIGNED_IN) return null;
  const n = Number(value);
  return (IDLE_TIMEOUT_OPTIONS as readonly number[]).includes(n) ? n : IDLE_TIMEOUT_MINUTES;
}

/** Set while a tablet is locked to the front-desk kiosk (app/kiosk); every other page redirects there. */
export const KIOSK_COOKIE = "st_kiosk";

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

/**
 * Only allow redirecting back to a path on this site. Browsers treat "\\" like
 * "/" and drop tabs and newlines, so "/\\evil.com" or "/\t/evil.com" would
 * leave the site: reject backslashes and control characters, then confirm the
 * path resolves to this same origin.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return "/";
  try {
    const base = "https://app.invalid";
    const url = new URL(next, base);
    return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : "/";
  } catch {
    return "/";
  }
}
