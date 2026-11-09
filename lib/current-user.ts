import { redirect } from "next/navigation";
import { getAuthState } from "@/lib/session";

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
  return state.user.id;
}
