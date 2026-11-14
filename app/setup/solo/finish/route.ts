import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { query } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { getMembership } from "@/lib/org";
import { parseMoney } from "@/lib/money";
import { logEvent } from "@/lib/events";
import { clearDraftEverywhere, draftForAccount } from "@/lib/setup";

export const dynamic = "force-dynamic";

/** Right after the email is verified: saves what they'll use Surfdesk for (and any services), then on to the first person. */
export async function GET() {
  const userId = await requireUserId();
  const d = await draftForAccount(userId);
  if (d?.flow !== "solo" || (await getMembership())) {
    await clearDraftEverywhere(userId);
    redirect("/");
  }
  await query(`update users set use_case = $2, setup_step = 'solo:first' where id = $1`, [userId, d.use ?? null]);
  let pos = 1;
  for (const s of d.services ?? []) {
    const cents = parseMoney(s.price);
    await query(
      `insert into services (org_id, user_id, name, price_cents, position)
       select null, $1, $2, $3, $4
        where not exists (select 1 from services where org_id is null and user_id = $1 and lower(name) = lower($2) and archived_at is null)`,
      [userId, s.name, cents !== null && Number.isFinite(cents) && cents <= 100000000 ? cents : null, pos++],
    );
  }
  await logEvent("setup.solo_started", "Individual set-up: account verified", {
    meta: { user: userId, use: d.use ?? null, services: d.services?.length ?? 0, offer: Boolean(d.offer), ...(d.utm ?? {}) },
  }).catch(() => undefined);
  await clearDraftEverywhere(userId);
  revalidatePath("/", "layout");
  redirect(`/setup/solo/first${d.offer ? "?offer=skip" : ""}`);
}
