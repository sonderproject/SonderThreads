"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { mineOrOrg } from "@/lib/db/scope";
import { query, queryOne } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { KIOSK_COOKIE } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/session";
import { createPersonRecord } from "./people";
import { getMembership } from "@/lib/org";

/** The front-desk kiosk is an Organization-plan feature. */
async function requireOrg(): Promise<void> {
  const m = await getMembership();
  if (!m?.active) redirect("/kiosk");
}
import { createCheckIn } from "./check-ins";
import { toActionResult, type ActionResult } from "@/lib/validation";
import { DEFAULT_KIOSK_REASONS } from "@/lib/kiosk-shared";


/** Kiosk setup: the 4-digit PIN that exits kiosk mode, and the reason buttons. */
export async function saveKioskSetup(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  await requireOrg();
  const pin = formData.get("pin")?.toString() ?? "";
  const confirmPin = formData.get("confirm")?.toString() ?? "";
  const reasons = (formData.get("reasons")?.toString() ?? "")
    .split(/\n|,/)
    .map((r) => r.trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 8);
  const existing = await queryOne<{ kiosk_pin_hash: string | null }>(`select kiosk_pin_hash from user_settings where user_id = $1`, [userId]);
  let pinHash = existing?.kiosk_pin_hash ?? null;
  if (pin || !pinHash) {
    if (!/^\d{4}$/.test(pin)) redirect("/kiosk?error=pin-format");
    if (pin !== confirmPin) redirect("/kiosk?error=pin-match");
    pinHash = await hashPassword(pin);
  }
  await query(
    `insert into user_settings (user_id, kiosk_pin_hash, kiosk_reasons) values ($1, $2, $3)
     on conflict (user_id) do update set kiosk_pin_hash = excluded.kiosk_pin_hash, kiosk_reasons = excluded.kiosk_reasons, updated_at = now()`,
    [userId, pinHash, reasons.length ? reasons : DEFAULT_KIOSK_REASONS],
  );
  redirect("/kiosk?saved=1");
}

/** Lock this device to the kiosk screen. */
export async function startKiosk(): Promise<void> {
  const userId = await requireUserId();
  await requireOrg();
  const row = await queryOne<{ kiosk_pin_hash: string | null }>(`select kiosk_pin_hash from user_settings where user_id = $1`, [userId]);
  if (!row?.kiosk_pin_hash) redirect("/kiosk?error=no-pin");
  (await cookies()).set(KIOSK_COOKIE, "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/kiosk");
}

/** Leave kiosk mode with the PIN. */
export async function exitKiosk(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const pin = formData.get("pin")?.toString() ?? "";
  const row = await queryOne<{ kiosk_pin_hash: string | null }>(`select kiosk_pin_hash from user_settings where user_id = $1`, [userId]);
  if (!/^\d{4}$/.test(pin) || !(await verifyPassword(pin, row?.kiosk_pin_hash ?? null))) {
    await new Promise((r) => setTimeout(r, 1200)); // slow down guessing
    redirect("/kiosk?error=wrong-pin");
  }
  (await cookies()).delete(KIOSK_COOKIE);
  redirect("/check-ins");
}

/**
 * A client checks themselves in at the kiosk. An exact name match (ignoring
 * case) checks in that person; otherwise a new person is added. Nothing about
 * other clients is ever sent back to the screen.
 */
export async function kioskCheckIn(firstName: string, lastName: string, reason: string): Promise<ActionResult<{ firstName: string }>> {
  return toActionResult(async () => {
    const userId = await requireUserId();
    const first = firstName.trim().replace(/\s+/g, " ").slice(0, 80);
    const last = lastName.trim().replace(/\s+/g, " ").slice(0, 80);
    if (!first) throw new Error("Please enter your first name.");
    if (!last) throw new Error("Please enter your last name.");
    const settings = await queryOne<{ kiosk_reasons: string[] | null }>(`select kiosk_reasons from user_settings where user_id = $1`, [userId]);
    const allowed = settings?.kiosk_reasons?.length ? settings.kiosk_reasons : DEFAULT_KIOSK_REASONS;
    const why = allowed.includes(reason) ? reason : null;
    const fullName = `${first} ${last}`;
    const match = await queryOne<{ id: string }>(
      `select id from people where ${mineOrOrg("$1")} and deleted_at is null and lower(display_name) = lower($2)
        order by last_activity_at desc limit 1`,
      [userId, fullName],
    );
    const personId = match?.id ?? (await createPersonRecord({ fullName })).id;
    // Same reason text as staff use, so kiosk check-ins count together in Impact.
    await createCheckIn({ personId, reason: why });
    return { firstName: first };
  });
}
