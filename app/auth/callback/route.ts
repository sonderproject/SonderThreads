import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServer } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth";
import { query, queryOne } from "@/lib/db/client";
import { recordAcceptance } from "@/lib/legal-server";
import { FRIEND_COOKIE, applyFriendsCode, checkFriendsCode } from "@/lib/friends";
import { readDraft, saveDraftToAccount, setupFlowFor } from "@/lib/setup";
import { isLikelyBot, logEvent } from "@/lib/events";
import { validTimeZone } from "@/lib/notify/phone";
import { OAUTH_COOKIE, parseContext } from "@/lib/oauth";

/**
 * Where Google and Apple send people back (via Supabase). Signs them in; for a
 * brand-new account it also does what the sign-up form does: the account row,
 * the Terms agreement shown next to the button, the friends link, the guided
 * setup answers and the owner's sign-up event. No confirmation email: the
 * provider already verified the address.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const jar = await cookies();
  const ctx = parseContext(jar.get(OAUTH_COOKIE)?.value);
  const next = safeNextPath(params.get("next") ?? ctx?.next);
  const back = ctx?.from === "login" ? "/login" : "/signup";
  const fail = (why: string) => {
    const to = new URL(back, request.url);
    to.search = new URLSearchParams({ error: why === "access_denied" ? "oauth_cancelled" : "oauth", next }).toString();
    return NextResponse.redirect(to);
  };

  // The person pressed Cancel at Google/Apple, or the provider refused.
  const providerError = params.get("error");
  if (providerError) {
    if (providerError !== "access_denied") await logEvent("auth.oauth_failed", "Google/Apple sign-in came back with an error", { level: "warn", path: back, meta: { reason: params.get("error_description")?.slice(0, 200) ?? providerError } });
    return fail(providerError);
  }
  const code = params.get("code");
  if (!code) return fail("no_code");

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    await logEvent("auth.oauth_failed", "Google/Apple sign-in couldn't finish", { level: "error", path: back, meta: { reason: error?.code ?? error?.message ?? "no user" } });
    return fail("exchange");
  }
  jar.delete(OAUTH_COOKIE);

  const user = data.user;
  const email = (user.email ?? "").toLowerCase();
  const provider = user.app_metadata?.provider ?? "oauth";
  const meta = user.user_metadata ?? {};
  // Apple shares the name only the very first time, so keep it now.
  const name = String(meta.full_name ?? meta.name ?? [meta.given_name, meta.family_name].filter(Boolean).join(" ") ?? "").trim().slice(0, 120) || null;

  const created = await queryOne<{ id: string }>(
    `insert into users (id, email, name, timezone) values ($1, $2, $3, $4)
     on conflict (id) do nothing returning id`,
    [user.id, email, name, validTimeZone(ctx?.timeZone ?? undefined)],
  ).catch(async (err: unknown) => {
    await logEvent("auth.oauth_failed", "Couldn't create the account row after Google/Apple sign-in", { level: "error", email, meta: { reason: err instanceof Error ? err.message.slice(0, 200) : "insert" } });
    return null;
  });

  if (created) {
    // The button sits right above "By continuing you agree to the Terms…", so that's the agreement.
    if (ctx?.consent) await recordAcceptance(user.id, "user");
    const friend = jar.get(FRIEND_COOKIE)?.value;
    if (friend && (await checkFriendsCode(friend))) {
      await applyFriendsCode(user.id, email);
      jar.delete(FRIEND_COOKIE);
    }
    const flow = setupFlowFor(next);
    if (flow) await saveDraftToAccount(user.id);
    const fid = flow ? (await readDraft())?.fid : undefined;
    await logEvent("auth.signup", isLikelyBot(email) ? "New sign-up (likely bot)" : "New sign-up", {
      email,
      path: back,
      meta: { ...(ctx?.utm ?? {}), provider, ...(flow ? { flow, fid: fid ?? null } : {}), device: deviceKind(request.headers.get("user-agent") ?? "") },
    });
  } else if (name) {
    // Existing account signing in with Google/Apple for the first time: fill in a missing name only.
    await query(`update users set name = $2 where id = $1 and (name is null or name = '')`, [user.id, name]).catch(() => {});
  }

  return NextResponse.redirect(new URL(next, request.url));
}

function deviceKind(ua: string): "phone" | "tablet" | "computer" {
  if (/iPad|Tablet|(Android(?!.*Mobile))/i.test(ua)) return "tablet";
  if (/Mobi|iPhone|Android/i.test(ua)) return "phone";
  return "computer";
}
