import { headers } from "next/headers";
import { query, queryOne } from "@/lib/db/client";
import { safeEqual } from "@/lib/auth";
import { alertOwner, logEvent } from "@/lib/events";

/**
 * Friends & family link: https://thesurfdesk.app/signup?friend=<FRIENDS_CODE>.
 * Anyone who signs up through it is free for life (plan 'comp'), no card, no
 * step for the owner. Link only: there is no visible code box anywhere, and it
 * is kept separate from any future referral discounts.
 *
 * Locked down against guessing:
 * - The code is only checked on the server, compared in constant time.
 * - Each network gets FRIENDS_TRIES_PER_IP wrong codes (default 5) per 24 hours;
 *   after that even the right code is refused from that network.
 * - If more than FRIENDS_TRIES_GLOBAL wrong codes (default 30) arrive in an hour
 *   from anywhere, the link is switched off for everyone until it calms down.
 * - Both lockouts, and every successful use, email the owner.
 * - A wrong or locked code shows the plain sign-up page, so a guesser learns nothing
 *   from the page; the link page itself is never indexed.
 * - Capped at FRIENDS_MAX sign-ups (default 25) in case the link is passed around.
 * Change FRIENDS_CODE in Vercel (and redeploy) to retire a link; existing free
 * accounts stay free (undo per account in the command center → Accounts).
 */
const USED = "auth.friend_signup";
const WRONG = "auth.friend_wrong";
export const FRIEND_COOKIE = "sd_friend";

function friendsCode(): string | null {
  const c = process.env.FRIENDS_CODE?.trim();
  return c && c.length >= 6 ? c : null;
}

function envNumber(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
}

/**
 * Is this the right code, from a network that isn't locked out? Wrong codes are
 * counted. Use for anything a visitor sends (the link, the form, the cookie).
 */
export async function checkFriendsCode(code: string | null | undefined): Promise<boolean> {
  const real = friendsCode();
  const given = code?.trim() ?? "";
  if (!real || !given) return false;
  const ip = await clientIp();
  try {
    const recent = await queryOne<{ by_ip: number; all_hour: number }>(
      `select count(*) filter (where meta->>'ip' = $2 and created_at > now() - interval '24 hours')::int as by_ip,
              count(*) filter (where created_at > now() - interval '1 hour')::int as all_hour
         from app_events where kind = $1 and created_at > now() - interval '24 hours'`,
      [WRONG, ip],
    );
    const perIp = envNumber("FRIENDS_TRIES_PER_IP", 5);
    const global = envNumber("FRIENDS_TRIES_GLOBAL", 30);
    if ((recent?.all_hour ?? 0) >= global) {
      await alertOwner(
        "Your friends & family link was switched off for an hour",
        [
          `More than ${global} wrong friends & family codes were tried in the last hour, so the link is off for everyone until that drops.`,
          "Someone may be guessing it. To be safe, change FRIENDS_CODE in Vercel to a longer code and redeploy (or ask Claude to).",
        ],
        { everyMinutes: 60 },
      );
      return false;
    }
    if ((recent?.by_ip ?? 0) >= perIp) return false;
    if (safeEqual(given, real)) return true;
    await logEvent(WRONG, "Wrong friends & family code", { level: "warn", meta: { ip } });
    if ((recent?.by_ip ?? 0) + 1 >= perIp) {
      await alertOwner(
        "Someone is guessing your friends & family code",
        [`A network (${ip}) tried ${perIp} wrong friends & family codes and is now blocked from it for 24 hours.`],
        { everyMinutes: 60 },
      );
    }
    return false;
  } catch (err) {
    console.error("[friends] check failed", err);
    return false;
  }
}

/** After the account row exists: make it free for life (the code was already checked) unless the cap is reached. */
export async function applyFriendsCode(userId: string, email: string): Promise<void> {
  try {
    const used = await queryOne<{ n: number }>(`select count(*)::int n from app_events where kind = $1`, [USED]);
    const max = envNumber("FRIENDS_MAX", 25);
    if ((used?.n ?? 0) >= max) {
      await logEvent("auth.friend_signup_full", "Friends link used after its limit; account left on the normal trial", { level: "warn", email });
      await alertOwner("Your friends & family link is full", [`It has been used ${max} times. New sign-ups through it now get the normal trial.`], {
        everyMinutes: 1440,
      });
      return;
    }
    await query(
      `insert into billing_accounts (user_id, plan, status) values ($1, 'comp', 'comp')
       on conflict (user_id) do update set plan = 'comp', status = 'comp', updated_at = now()`,
      [userId],
    );
    await logEvent(USED, "Friends & family sign-up: free for life", { email, path: "/signup" });
    await alertOwner("New friends & family sign-up", [
      `${email} signed up through your friends & family link and is free for life (${(used?.n ?? 0) + 1} of ${max} used).`,
      "Not someone you invited? Command center → Accounts → turn off Free for life, and change the code.",
    ]);
  } catch (err) {
    console.error("[friends] making the account free failed", err);
  }
}
