import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";

/**
 * The id of the signed-in user whose data a request may read or write.
 * Every query gets its user_id from here. With no valid session it
 * redirects to sign-in, so no query ever runs without a real user.
 *
 * Route Handlers under /api should use getSessionUser() instead and return
 * a 401, since a redirect to an HTML page is useless to an API client.
 */
export async function requireUserId(): Promise<string> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user.id;
}
