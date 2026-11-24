"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth";
import { FRIEND_COOKIE, checkFriendsCode } from "@/lib/friends";
import { logEvent } from "@/lib/events";
import { OAUTH_COOKIE, enabledProviders, type OAuthProvider } from "@/lib/oauth";
import { setupFlowFor } from "@/lib/setup";
import { markOrgAgreed } from "@/lib/actions/setup";

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

/**
 * "Continue with Google/Apple": remembers what the page knew (next step, campaign tags,
 * time zone, friends link), then sends the person to the provider. They come back to
 * /auth/callback already verified, with no email to confirm.
 */
export async function startOAuth(formData: FormData): Promise<void> {
  const provider = formData.get("provider") as OAuthProvider;
  const from = formData.get("from") === "login" ? "login" : "signup";
  const next = safeNextPath(formData.get("next")?.toString());
  const back = from === "login" ? "/login" : "/signup";
  if (!enabledProviders().includes(provider)) redirect(`${back}?error=oauth`);

  const jar = await cookies();
  const utm = Object.fromEntries(
    ["utm_source", "utm_medium", "utm_campaign", "utm_content"]
      .map((k) => [k, formData.get(k)?.toString().trim().slice(0, 80) ?? ""])
      .filter(([, v]) => v),
  );
  jar.set(
    OAUTH_COOKIE,
    JSON.stringify({ next, utm, timeZone: formData.get("timezone")?.toString().slice(0, 64) || null, consent: true, from }),
    { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 30 * 60 },
  );
  // Organization set-up: the notice under the buttons includes the organization agreement.
  if (setupFlowFor(next) === "org") await markOrgAgreed();
  // Friends & family link: checked now (with its guess limits) and kept for the callback.
  const friend = formData.get("friend")?.toString().trim();
  if (friend && (await checkFriendsCode(friend))) {
    jar.set(FRIEND_COOKIE, friend, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 7 * 86_400 });
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${await origin()}/auth/callback?${new URLSearchParams({ next })}`,
      // Google: always let people pick which account (common on shared or work computers).
      queryParams: provider === "google" ? { prompt: "select_account" } : undefined,
    },
  });
  if (error || !data.url) {
    await logEvent("auth.oauth_failed", `Couldn't start ${provider} sign-in`, { level: "error", path: back, meta: { provider, reason: error?.message ?? "no url" } });
    redirect(`${back}?error=oauth`);
  }
  redirect(data.url);
}
