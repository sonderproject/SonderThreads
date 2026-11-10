import { createHash } from "node:crypto";
import { queryOne } from "@/lib/db/client";

/**
 * One account per mobile number (stops repeat free trials), except the
 * owner's own number, which can be on several accounts. Stored as a SHA-256 of
 * the E.164 number so the number itself isn't in the code.
 */
const REUSABLE = new Set(["20d71e35f5cf1ea78a9007052fdd94be72927cb00643a897d0a1ac56950350a4"]);

/** True when another account already uses this (normalized, E.164) number. */
export async function phoneTaken(phone: string, exceptUserId?: string): Promise<boolean> {
  if (REUSABLE.has(createHash("sha256").update(phone).digest("hex"))) return false;
  const row = await queryOne(`select 1 from users where phone = $1 and ($2::uuid is null or id <> $2::uuid) limit 1`, [
    phone,
    exceptUserId ?? null,
  ]);
  return Boolean(row);
}
