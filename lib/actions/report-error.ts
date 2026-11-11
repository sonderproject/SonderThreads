"use server";

import { logEvent } from "@/lib/events";
import { queryOne } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";

/** The in-app error screen reports what the person hit, for the owner's command center. */
export async function reportClientError(message: string, path: string, digest?: string): Promise<void> {
  let email: string | null = null;
  try {
    const me = await queryOne<{ email: string }>(`select email from users where id = $1`, [await requireUserId()]);
    email = me?.email ?? null;
  } catch {
    // signed out or no database: still record it
  }
  await logEvent("app.error_screen", String(message).slice(0, 500), {
    level: "error",
    email,
    path: String(path).slice(0, 300),
    meta: { digest: digest ?? null },
  });
}
