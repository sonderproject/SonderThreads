"use server";

import { alertOwner, logEvent } from "@/lib/events";

/**
 * The sign-in/sign-up security check (Cloudflare Turnstile) couldn't run in someone's browser.
 * Logged for the command center, and the owner is emailed (at most once an hour), because a
 * broken check means nobody can sign in or sign up. The usual cause: the site's web address
 * isn't in the Turnstile widget's hostname list in Cloudflare.
 */
export async function reportCaptchaProblem(code: string, hostname: string, keyEnd = ""): Promise<void> {
  const c = String(code).replace(/[^\w.-]/g, "").slice(0, 40) || "unknown";
  const host = String(hostname).replace(/[^\w.-]/g, "").slice(0, 100);
  const key = String(keyEnd).replace(/[^\w-]/g, "").slice(0, 8);
  await logEvent("auth.captcha_error", `Security check failed to run (${c}) on ${host}, site key …${key}`, { level: "warn", path: host, meta: { code: c, key } });
  // 110200 = this hostname isn't allowed for the widget; 4xx/6xx codes are mostly browser-side.
  if (c.startsWith("1102") || c === "timeout" || c === "script-blocked") {
    await alertOwner(
      "Sign-in security check isn't loading",
      [
        `The Cloudflare Turnstile check failed with "${c}" on ${host}.`,
        c.startsWith("1102")
          ? `Add ${host} to the widget's Hostname Management list in Cloudflare (Turnstile → your widget → Settings).`
          : "If this keeps coming in from many people, check the widget in Cloudflare and the Supabase CAPTCHA setting.",
      ],
      { everyMinutes: 60 },
    );
  }
}
