import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { transaction, query } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { getMembership } from "@/lib/org";
import { recordAcceptance } from "@/lib/legal-server";
import { billingEnabled } from "@/lib/billing";
import { parseMoney } from "@/lib/money";
import { logEvent } from "@/lib/events";
import { clearDraftEverywhere, draftForAccount, seatsForTeamSize } from "@/lib/setup";

export const dynamic = "force-dynamic";

/**
 * Right after the email is verified: creates the organization from the
 * answers kept in this browser (name, type, team size, time zone, services),
 * with this person as its admin, then continues to Start (trial or pay).
 */
export async function GET() {
  const userId = await requireUserId();
  if (await getMembership()) {
    await clearDraftEverywhere(userId);
    redirect("/");
  }
  const d = await draftForAccount(userId);
  // No answers anywhere (expired, or signed up without the set-up): the short form still works.
  if (d?.flow !== "org" || !d.name || !d.kind || !d.agreed) redirect("/organization/new");

  const orgId = await transaction(async (q) => {
    const res = (await q(
      `insert into organizations (name, created_by, kind, referral_timezone, planned_seats) values ($1, $2, $3, $4, $5) returning id`,
      [d.name, userId, d.kind, d.timezone ?? null, seatsForTeamSize(d.size)],
    )) as { rows: { id: string }[] };
    const id = res.rows[0].id;
    await q(`insert into memberships (org_id, user_id, role) values ($1, $2, 'admin')`, [id, userId]);
    let pos = 1;
    for (const s of d.services ?? []) {
      const cents = parseMoney(s.price);
      await q(`insert into services (org_id, user_id, name, price_cents, position) values ($1, null, $2, $3, $4)`, [
        id,
        s.name,
        cents !== null && Number.isFinite(cents) && cents <= 100000000 ? cents : null,
        pos++,
      ]);
    }
    return id;
  });
  await recordAcceptance(userId, "organization", orgId);
  await query(`update users set setup_step = $2 where id = $1`, [userId, billingEnabled() ? "org:plan" : "org:team"]);
  await logEvent("setup.org_created", `Organization set up: ${d.name}`, {
    meta: { org: orgId, kind: d.kind, size: d.size ?? null, services: d.services?.length ?? 0, offer: Boolean(d.offer), ...(d.utm ?? {}) },
  }).catch(() => undefined);
  await clearDraftEverywhere(userId);
  revalidatePath("/", "layout");
  redirect(billingEnabled() ? `/setup/org/plan${d.offer ? "?offer=skip" : ""}` : "/setup/org/team");
}
