import { headers } from "next/headers";
import { query } from "@/lib/db/client";
import { LEGAL_VERSION } from "@/lib/legal";

export type AcceptanceKind = "user" | "organization" | "membership";

/**
 * Records that `userId` agreed to the current Terms and Privacy policy: for
 * themselves ("user"), on an organization's behalf ("organization"), or when
 * joining one ("membership"). Keeps the IP and browser as evidence.
 */
export async function recordAcceptance(userId: string, kind: AcceptanceKind, orgId: string | null = null): Promise<void> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || null;
  const agent = h.get("user-agent")?.slice(0, 500) ?? null;
  await query(
    `insert into legal_acceptances (user_id, org_id, kind, version, ip, user_agent) values ($1, $2, $3, $4, $5, $6)`,
    [userId, orgId, kind, LEGAL_VERSION, ip, agent],
  );
  if (kind === "user") {
    await query(`update users set terms_version = $2, terms_accepted_at = now() where id = $1`, [userId, LEGAL_VERSION]);
  } else if (kind === "organization" && orgId) {
    await query(
      `update organizations set terms_version = $2, terms_accepted_at = now(), terms_accepted_by = $3 where id = $1`,
      [orgId, LEGAL_VERSION, userId],
    );
  }
}
