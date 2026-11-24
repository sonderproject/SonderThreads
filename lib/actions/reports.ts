"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db/client";
import { assertCanWrite } from "@/lib/billing";
import { takeQuota } from "@/lib/usage";
import { reportAccess } from "@/lib/reports";
import { sendReport, type ScheduleRow } from "@/lib/reports-run";
import { REPORT_LIMITS, addDays, cleanSchedule, cleanTiles } from "@/lib/dashboard-shared";
import { dayKey } from "@/lib/tz";

const isId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
/** Where the page goes next; the form reloads to it (components/reports/ActionForm.tsx). */
const back = (q: string) => `/reports?tab=scheduled&${q}`;

async function access() {
  const a = await reportAccess();
  if (!a) redirect("/");
  return a!;
}

/** Saves which tiles this person sees on their dashboard. */
export async function saveDashboardTiles(tiles: string[]): Promise<{ ok: boolean }> {
  const a = await reportAccess();
  if (!a) return { ok: false };
  const clean = cleanTiles(tiles, a.audience);
  await query(
    `insert into dashboard_layouts (user_id, tiles) values ($1, $2) on conflict (user_id) do update set tiles = excluded.tiles, updated_at = now()`,
    [a.userId, clean],
  );
  return { ok: true };
}

function fields(formData: FormData): Record<string, unknown> {
  return {
    name: formData.get("name"),
    frequency: formData.get("frequency"),
    weekday: formData.get("weekday"),
    monthDay: formData.get("month_day"),
    hour: formData.get("hour"),
    recipients: formData.get("recipients"),
    attachPdf: formData.get("attach_pdf"),
    tiles: formData.getAll("tiles"),
  };
}

/** New schedule (or an edit, with `id`). Whoever saves it owns it. */
export async function saveSchedule(formData: FormData): Promise<string> {
  const a = await access();
  await assertCanWrite();
  const s = cleanSchedule(fields(formData), a.audience, Boolean(a.scope.orgId));
  const where = a.scope.orgId ? "org_id = $1" : "org_id is null and user_id = $1";
  const param = a.scope.orgId ?? a.userId;
  const id = formData.get("id");
  if (isId(id)) {
    const row = await queryOne(
      `update report_schedules set user_id = $3, name = $4, frequency = $5, weekday = $6, month_day = $7, hour = $8, recipients = $9,
              attach_pdf = $10, tiles = $11, updated_at = now()
        where ${where} and id = $2 and deleted_at is null returning id`,
      [param, id, a.userId, s.name, s.frequency, s.weekday, s.monthDay, s.hour, s.recipients, s.attachPdf, s.tiles],
    );
    if (!row) return back("error=gone");
  } else {
    const n = await queryOne<{ n: number }>(`select count(*)::int as n from report_schedules where ${where} and deleted_at is null`, [param]);
    if ((n?.n ?? 0) >= REPORT_LIMITS.schedulesPerAccount) return back("error=limit");
    await query(
      `insert into report_schedules (user_id, org_id, name, frequency, weekday, month_day, hour, recipients, attach_pdf, tiles)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [a.userId, a.scope.orgId, s.name, s.frequency, s.weekday, s.monthDay, s.hour, s.recipients, s.attachPdf, s.tiles],
    );
  }
  revalidatePath("/reports");
  return back("saved=schedule");
}

export async function setScheduleEnabled(formData: FormData): Promise<string> {
  const a = await access();
  const id = formData.get("id");
  const on = formData.get("enabled") === "1";
  if (isId(id))
    await query(`update report_schedules set enabled = $3, updated_at = now() where ${a.scope.orgId ? "org_id = $1" : "org_id is null and user_id = $1"} and id = $2`, [
      a.scope.orgId ?? a.userId,
      id,
      on,
    ]);
  revalidatePath("/reports");
  return back(`saved=${on ? "resumed" : "paused"}`);
}

export async function deleteSchedule(formData: FormData): Promise<string> {
  const a = await access();
  const id = formData.get("id");
  if (isId(id))
    await query(`update report_schedules set deleted_at = now(), enabled = false where ${a.scope.orgId ? "org_id = $1" : "org_id is null and user_id = $1"} and id = $2`, [
      a.scope.orgId ?? a.userId,
      id,
    ]);
  revalidatePath("/reports");
  return back("saved=deleted");
}

/** "Send me one now": the last full period, to the signed-in person only. */
export async function sendScheduleNow(formData: FormData): Promise<string> {
  const a = await access();
  const id = formData.get("id");
  const s = isId(id)
    ? await queryOne<ScheduleRow>(
        `select id, user_id, org_id, name, frequency, weekday, month_day, hour, recipients, attach_pdf, tiles from report_schedules
          where ${a.scope.orgId ? "org_id = $1" : "org_id is null and user_id = $1"} and id = $2 and deleted_at is null`,
        [a.scope.orgId ?? a.userId, id],
      )
    : null;
  if (!s) return back("error=gone");
  if (!(await takeQuota(a.userId, "export"))) return back("error=busy");
  const me = await queryOne<{ email: string }>(`select email from users where id = $1`, [a.userId]);
  const today = dayKey(new Date(), a.tz);
  const range =
    s!.frequency === "weekly"
      ? { from: addDays(today, -7), to: addDays(today, -1) }
      : (() => {
          const end = addDays(`${today.slice(0, 7)}-01`, -1);
          return { from: `${end.slice(0, 7)}-01`, to: end };
        })();
  try {
    // Runs as the signed-in person (they may report on this account), sent only to them.
    await sendReport({ ...s!, user_id: a.userId }, range, { onlyTo: me!.email });
  } catch (err) {
    console.error("[reports] send now failed", err instanceof Error ? err.message : err);
    return back("error=send");
  }
  return back("saved=sent");
}
