import { query, queryOne } from "@/lib/db/client";
import { safeEqual } from "@/lib/auth";
import { logEvent } from "@/lib/events";

/**
 * Friends & family link: https://thesurfdesk.app/signup?friend=<FRIENDS_CODE>.
 * Anyone who signs up through it is free for life (plan 'comp'), no card, no
 * step for the owner. The code lives in Vercel (FRIENDS_CODE); change it to
 * kill an old link. Capped at FRIENDS_MAX sign-ups (default 25) in case the
 * link gets passed around. Each use is logged (app_events 'auth.friend_signup')
 * and can be undone per account in the command center (Accounts → Free for life).
 */
const KIND = "auth.friend_signup";
export const FRIEND_COOKIE = "sd_friend";

function friendsCode(): string | null {
  const c = process.env.FRIENDS_CODE?.trim();
  return c && c.length >= 6 ? c : null;
}

function friendsMax(): number {
  const n = Number(process.env.FRIENDS_MAX);
  return Number.isFinite(n) && n > 0 ? n : 25;
}

export function isFriendsCode(code: string | null | undefined): boolean {
  const real = friendsCode();
  return Boolean(real && code && safeEqual(code.trim(), real));
}

/** After the account row exists: make it free for life if the code is right and the cap isn't reached. */
export async function applyFriendsCode(userId: string, email: string, code: string | null | undefined): Promise<void> {
  if (!isFriendsCode(code)) return;
  try {
    const used = await queryOne<{ n: number }>(`select count(*)::int n from app_events where kind = $1`, [KIND]);
    if ((used?.n ?? 0) >= friendsMax()) {
      await logEvent("auth.friend_signup_full", "Friends link used after its limit; account left on the normal trial", { level: "warn", email });
      return;
    }
    await query(
      `insert into billing_accounts (user_id, plan, status) values ($1, 'comp', 'comp')
       on conflict (user_id) do update set plan = 'comp', status = 'comp', updated_at = now()`,
      [userId],
    );
    await logEvent(KIND, "Friends & family sign-up: free for life", { email, path: "/signup" });
  } catch (err) {
    console.error("[friends] making the account free failed", err);
  }
}
