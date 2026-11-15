import { headers } from "next/headers";
import { query } from "@/lib/db/client";

/**
 * Marketing emails from Sonder Project: opt-in only (unchecked by default). The exact wording a
 * person saw is stored with every change (marketing_consents), as evidence of what they agreed to.
 * Sending stays off until POSTAL_ADDRESS is set (CAN-SPAM); see lib/lifecycle.ts.
 */
import { MARKETING_WORDING } from "@/lib/marketing-wording";

export { MARKETING_WORDING };

export type ConsentSource = "signup" | "prompt" | "settings" | "unsubscribe";

export async function recordMarketingChoice(userId: string, optedIn: boolean, source: ConsentSource): Promise<void> {
  let ip: string | null = null;
  let agent: string | null = null;
  try {
    const h = await headers();
    ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
    agent = h.get("user-agent")?.slice(0, 500) ?? null;
  } catch {
    // Outside a request (e.g. a background job): saved without IP and browser.
  }
  await query(
    `update users set marketing_opt_in = $2, marketing_prompted_at = coalesce(marketing_prompted_at, now()) where id = $1`,
    [userId, optedIn],
  );
  await query(
    `insert into marketing_consents (user_id, opted_in, wording, source, ip, user_agent) values ($1, $2, $3, $4, $5, $6)`,
    [userId, optedIn, MARKETING_WORDING, source, ip, agent],
  );
}
