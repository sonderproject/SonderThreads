import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { getAuthState } from "@/lib/session";
import { KIOSK_COOKIE } from "@/lib/auth";
import { inKioskAction } from "@/lib/kiosk-guard";

/**
 * The id of the signed-in user whose data a request may read or write.
 * Every query gets its user_id from here. With no valid session it
 * redirects to sign-in (or to the 2FA step if that's still pending), so no
 * query ever runs without a fully authenticated user.
 *
 * Route Handlers under /api should use getSessionUser() instead and return
 * a 401, since a redirect to an HTML page is useless to an API client.
 */
export async function requireUserId(): Promise<string> {
  const state = await getAuthState();
  if (state.status === "needs-2fa") redirect("/login/2fa");
  if (state.status !== "signed-in") redirect("/login");
  // On a kiosk tablet, only the kiosk's own server actions may run (lib/kiosk-guard.ts).
  if (!inKioskAction()) {
    const [c, h] = await Promise.all([cookies(), headers()]);
    if (c.get(KIOSK_COOKIE)?.value === "1" && h.get("next-action")) throw new Error("Not available on the kiosk.");
  }
  return state.user.id;
}
