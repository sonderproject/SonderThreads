"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne, transaction } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { getMembership } from "@/lib/org";
import { assertCanWrite } from "@/lib/billing";
import { logEvent } from "@/lib/events";
import { toActionResult, type ActionResult } from "@/lib/validation";

/**
 * "Try it with sample clients": fills an empty account with 12 made-up
 * people and a month of visits, so Home, People and the Impact/Insights
 * report show what Surfdesk does on day one. Every sample row is marked
 * (people.is_sample) and "Remove sample data" takes it all out again (the
 * people and their check-ins are deleted, so they leave every report).
 * Sample people don't count toward the trial's import limit.
 */

const NAMES = [
  ["Ana", "Lopez"], ["Marcus", "Reed"], ["Priya", "Shah"], ["Jordan", "Kim"], ["Fatima", "Hassan"], ["Luis", "Garcia"],
  ["Grace", "Okafor"], ["Tom", "Walsh"], ["Mei", "Chen"], ["Dev", "Patel"], ["Rosa", "Diaz"], ["Sam", "Turner"],
] as const;
const ETHNICITY = ["Hispanic or Latino", "Black or African American", "Asian", "Asian", "Middle Eastern or North African", "Hispanic or Latino", "Black or African American", "White", "Asian", "Asian", "Hispanic or Latino", "White"];
const GENDER = ["Female", "Male", "Female", "Non-binary", "Female", "Male", "Female", "Male", "Female", "Male", "Female", "Male"];
const INCOME = ["Low", "Low", "Medium", "Low", "None", "Medium", "Low", "Medium", "High", "Medium", "Low", "Prefer not to say"];
const REASONS = {
  nonprofit: ["Housing help", "Food assistance", "Job readiness", "Benefits help", "Case management"],
  business: ["Consultation", "Appointment", "Follow-up visit", "Class or session"],
  individual: ["Catch-up", "Follow-up", "Check-in call", "Coffee"],
};

/** Is there sample data in this account (for the "Remove sample data" banner)? */
export async function hasSampleData(): Promise<boolean> {
  const userId = await requireUserId();
  return Boolean(await queryOne(`select 1 from people where user_id = $1 and is_sample and deleted_at is null limit 1`, [userId]));
}

/** Can this account load sample data (empty, and not a staff member of an organization)? */
export async function canLoadSampleData(): Promise<boolean> {
  const userId = await requireUserId();
  const m = await getMembership();
  if (m?.active && m.role !== "admin") return false;
  const any = m?.active
    ? await queryOne(`select 1 from people where (org_id = $1 or user_id = $2) and deleted_at is null limit 1`, [m.orgId, userId])
    : await queryOne(`select 1 from people where user_id = $1 and deleted_at is null limit 1`, [userId]);
  return !any;
}

export async function loadSampleData(): Promise<ActionResult<{ people: number }>> {
  return toActionResult(async () => {
    const userId = await requireUserId();
    await assertCanWrite();
    if (!(await canLoadSampleData())) throw new Error("Sample data is only for an empty account. Remove your people first, or just keep going with your own.");
    const m = await getMembership();
    const audience = m?.active ? (m.orgKind === "business" ? "business" : "nonprofit") : "individual";
    // Use the account's own services when it has them, so the services table and revenue fill in too.
    const services = await query<{ id: string; name: string; price_cents: number | null }>(
      m?.active
        ? `select id, name, price_cents from services where org_id = $1 and archived_at is null order by position limit 6`
        : `select id, name, price_cents from services where org_id is null and user_id = $1 and archived_at is null order by position limit 6`,
      [m?.active ? m.orgId : userId],
    );
    const reasons = services.length ? services.map((s) => s.name) : REASONS[audience];

    let checkIns = 0;
    await transaction(async (q) => {
      await q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: userId })]);
      const tz = ((await q(`select coalesce(timezone, 'UTC') as tz from users where id = $1`, [userId])) as unknown as { rows: { tz: string }[] }).rows[0]?.tz ?? "UTC";
      for (const [i, [first, last]] of NAMES.entries()) {
        // About half are returning clients (on the books for months), half new this month.
        const sinceDays = i % 2 === 0 ? 60 + i * 7 : 3 + i * 2;
        const person = (await q(
          `insert into people (user_id, first_name, last_name, display_name, ethnicity, gender, income_level, client_since, is_sample, current_status)
           values ($1, $2, $3, $4, $5, $6, $7, (now() at time zone $8)::date - $9::int, true, $10) returning id`,
          [userId, first, last, `${first} ${last}`, audience === "individual" ? null : ETHNICITY[i], audience === "individual" ? null : GENDER[i],
           audience === "individual" ? null : INCOME[i], tz, sinceDays, "Sample person: remove any time from Home"],
        )) as unknown as { rows: { id: string }[] };
        const personId = person.rows[0].id;
        const visits = 1 + ((i * 7) % 4);
        for (let v = 0; v < visits; v++) {
          const daysAgo = Math.min(sinceDays, (i * 3 + v * 8) % 29);
          const hour = 9 + ((i + v * 3) % 8);
          const idx = (i + v) % reasons.length;
          const svc = services[idx];
          await q(
            `insert into check_ins (user_id, person_id, checked_in_at, reason, service_id, amount_cents)
             values ($1, $2, ((date_trunc('day', now() at time zone $3) - make_interval(days => $4) + make_interval(hours => $5)) at time zone $3), $6, $7, $8)`,
            [userId, personId, tz, daysAgo, hour, reasons[idx], svc?.id ?? null, svc?.price_cents ?? null],
          );
          checkIns++;
        }
      }
    });
    await logEvent("sample.loaded", "Sample data loaded", { meta: { user: userId, audience, checkIns } }).catch(() => undefined);
    revalidatePath("/", "layout");
    return { people: NAMES.length };
  });
}

export async function removeSampleData(): Promise<ActionResult<{ people: number }>> {
  return toActionResult(async () => {
    const userId = await requireUserId();
    const removed = await transaction(async (q) => {
      await q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: userId })]);
      await q(
        `update check_ins set deleted_at = now() where deleted_at is null
            and person_id in (select id from people where user_id = $1 and is_sample)`,
        [userId],
      );
      const r = (await q(`update people set deleted_at = now() where user_id = $1 and is_sample and deleted_at is null returning id`, [userId])) as unknown as {
        rows: unknown[];
      };
      return r.rows.length;
    });
    revalidatePath("/", "layout");
    return { people: removed };
  });
}
