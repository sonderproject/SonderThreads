import { query, queryOne } from "@/lib/db/client";
import { addDays, previousRange, type TileKey } from "@/lib/dashboard-shared";

/**
 * Dashboard numbers. Plain server module: callers pass a scope they already checked
 * (an organization the viewer may report on, or their own solo account). Counts only:
 * nothing here returns a name, note or free-text field. Tasks are never read (private).
 */

export type DashScope = { orgId: string | null; userId: string };
export type DashFilters = { memberId?: string | null; serviceId?: string | null; program?: { fieldId: string; value: string } | null };

export type Tile = {
  key: TileKey;
  value: number;
  prev: number;
  /** Over the period (daily up to 31 days, weekly up to ~6 months, else monthly). */
  series: number[];
  parts?: { label: string; value: number; tone?: "positive" | "neutral" | "unplanned" }[];
  /** e.g. the completion rate for form responses. */
  note?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Built = { where: string; params: unknown[] };

/**
 * WHERE clauses for one table. `$1` scope id, `$2` time zone, `$3` from, `$4` to; filters
 * add more. Person filters (member, program) apply through the row's person.
 */
function build(scope: DashScope, f: DashFilters, opts: { alias: string; date: string; person?: string; owner?: string; service?: boolean; dateIsDay?: boolean }): Built {
  const a = opts.alias;
  const params: unknown[] = [scope.orgId ?? scope.userId, "UTC", "", ""];
  const day = opts.dateIsDay ? `${a}.${opts.date}` : `(${a}.${opts.date} at time zone $2)::date`;
  // "$2::text is not null" keeps the time zone parameter referenced when a date column needs no conversion.
  const conds = [scope.orgId ? `${a}.org_id = $1` : `${a}.org_id is null and ${a}.user_id = $1`, `${day} between $3::date and $4::date`, `$2::text is not null`];
  if (f.memberId && UUID.test(f.memberId) && scope.orgId && opts.owner) {
    params.push(f.memberId);
    conds.push(`${a}.${opts.owner} = $${params.length}`);
  }
  if (f.serviceId && UUID.test(f.serviceId) && opts.service) {
    params.push(f.serviceId);
    conds.push(`${a}.service_id = $${params.length}`);
  }
  if (f.program && UUID.test(f.program.fieldId) && f.program.value && opts.person) {
    params.push(f.program.fieldId, f.program.value.slice(0, 200));
    conds.push(`exists (select 1 from people fp where fp.id = ${opts.person} and fp.custom_fields->>$${params.length - 1} = $${params.length})`);
  }
  return { where: conds.join(" and "), params };
}

function bucketOf(from: string, to: string): "day" | "week" | "month" {
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  return days <= 31 ? "day" : days <= 186 ? "week" : "month";
}

async function count(sql: string, b: Built, tz: string, from: string, to: string): Promise<number> {
  const p = [...b.params];
  p[1] = tz;
  p[2] = from;
  p[3] = to;
  const r = await queryOne<{ n: number }>(sql.replace("{W}", b.where), p);
  return Number(r?.n ?? 0);
}

async function series(expr: string, table: string, b: Built, dateExpr: string, tz: string, from: string, to: string): Promise<number[]> {
  const unit = bucketOf(from, to);
  const p = [...b.params];
  p[1] = tz;
  p[2] = from;
  p[3] = to;
  const rows = await query<{ k: string; n: number }>(
    `select to_char(date_trunc('${unit}', ${dateExpr}), 'YYYY-MM-DD') as k, ${expr} as n from ${table} where ${b.where} group by 1`,
    p,
  );
  const map = new Map(rows.map((r) => [r.k, Number(r.n)]));
  const keys: string[] = [];
  let k = from;
  const start = (d: string) => (unit === "day" ? d : unit === "month" ? `${d.slice(0, 7)}-01` : addDays(d, -((new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7)));
  k = start(k);
  while (k <= to) {
    keys.push(k);
    k = unit === "day" ? addDays(k, 1) : unit === "week" ? addDays(k, 7) : (() => {
      const [y, m] = k.split("-").map(Number);
      return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    })();
  }
  return keys.map((x) => map.get(x) ?? 0);
}

/** Every requested tile for the range, compared with the period before. */
export async function computeTiles(scope: DashScope, tz: string, from: string, to: string, tiles: TileKey[], f: DashFilters = {}): Promise<Tile[]> {
  const prev = previousRange(from, to);
  const visits = build(scope, f, { alias: "c", date: "checked_in_at", person: "c.person_id", owner: "user_id", service: true });
  const visitsTable = `check_ins c`;
  const visitsWhere = `select {SEL} from check_ins c where {W} and c.deleted_at is null`;
  const visitDate = `(c.checked_in_at at time zone $2)::date`;
  const out: Tile[] = [];

  for (const key of tiles) {
    switch (key) {
      case "visits":
      case "people_served":
      case "revenue": {
        const sel = key === "visits" ? "count(*)::int" : key === "people_served" ? "count(distinct c.person_id)::int" : "coalesce(sum(c.amount_cents), 0)::bigint";
        const sql = visitsWhere.replace("{SEL}", `${sel} as n`);
        out.push({
          key,
          value: await count(sql, visits, tz, from, to),
          prev: await count(sql, visits, tz, prev.from, prev.to),
          series: await series(sel, `${visitsTable}`, { ...visits, where: `${visits.where} and c.deleted_at is null` }, visitDate, tz, from, to),
        });
        break;
      }
      case "new_people": {
        const b = build(scope, f, { alias: "p", date: "created_at", person: "p.id", owner: "user_id" });
        const sql = `select count(*)::int as n from people p where {W} and p.deleted_at is null and not p.is_sample`;
        out.push({
          key,
          value: await count(sql, b, tz, from, to),
          prev: await count(sql, b, tz, prev.from, prev.to),
          series: await series("count(*)::int", "people p", { ...b, where: `${b.where} and p.deleted_at is null and not p.is_sample` }, `(p.created_at at time zone $2)::date`, tz, from, to),
        });
        break;
      }
      case "exits": {
        const b = build(scope, f, { alias: "e", date: "exited_on", person: "e.person_id", owner: "user_id", dateIsDay: true });
        const sql = `select count(*)::int as n from person_exits e where {W} and e.deleted_at is null`;
        const p = [...b.params];
        p[1] = tz;
        p[2] = from;
        p[3] = to;
        const kinds = await query<{ kind: "positive" | "neutral" | "unplanned"; n: number }>(
          `select kind, count(*)::int as n from person_exits e where ${b.where} and e.deleted_at is null group by kind`,
          p,
        );
        const by = (k: string) => kinds.find((x) => x.kind === k)?.n ?? 0;
        out.push({
          key,
          value: await count(sql, b, tz, from, to),
          prev: await count(sql, b, tz, prev.from, prev.to),
          series: await series("count(*)::int", "person_exits e", { ...b, where: `${b.where} and e.deleted_at is null` }, `e.exited_on`, tz, from, to),
          parts: [
            { label: "Positive", value: by("positive"), tone: "positive" },
            { label: "Neutral", value: by("neutral"), tone: "neutral" },
            { label: "Unplanned", value: by("unplanned"), tone: "unplanned" },
          ],
        });
        break;
      }
      case "form_responses": {
        // Every response counts, including ones later deleted (their answers are gone, the count stays).
        const b = build(scope, { ...f, serviceId: null }, { alias: "x", date: "created_at", person: "x.person_id", owner: "assigned_to" });
        const sql = `select count(*)::int as n from form_submissions x where {W}`;
        const value = await count(sql, b, tz, from, to);
        const views = await queryOne<{ n: number }>(
          `select coalesce(sum(v.views), 0)::int as n from form_views v join forms fo on fo.id = v.form_id
            where ${scope.orgId ? "fo.org_id = $1" : "fo.org_id is null and fo.user_id = $1"} and v.day between $2::date and $3::date`,
          [scope.orgId ?? scope.userId, from, to],
        );
        out.push({
          key,
          value,
          prev: await count(sql, b, tz, prev.from, prev.to),
          series: await series("count(*)::int", "form_submissions x", b, `(x.created_at at time zone $2)::date`, tz, from, to),
          note: views?.n ? `${Math.min(100, Math.round((value / views.n) * 100))}% of ${views.n} views` : undefined,
        });
        break;
      }
      case "automation_runs": {
        const b = build(scope, { serviceId: null }, { alias: "r", date: "created_at" });
        const sql = `select count(*)::int as n from workflow_runs r where {W} and r.status = 'done'`;
        out.push({
          key,
          value: await count(sql, b, tz, from, to),
          prev: await count(sql, b, tz, prev.from, prev.to),
          series: await series("count(*)::int", "workflow_runs r", { ...b, where: `${b.where} and r.status = 'done'` }, `(r.created_at at time zone $2)::date`, tz, from, to),
        });
        break;
      }
      case "top_services": {
        const p = [...visits.params];
        p[1] = tz;
        p[2] = from;
        p[3] = to;
        const rows = await query<{ name: string; n: number }>(
          `select s.name, count(*)::int as n from check_ins c join services s on s.id = c.service_id
            where ${visits.where} and c.deleted_at is null group by s.name order by n desc, s.name limit 5`,
          p,
        );
        const total = rows.reduce((a, r) => a + r.n, 0);
        out.push({ key, value: total, prev: 0, series: [], parts: rows.map((r) => ({ label: r.name, value: r.n })) });
        break;
      }
      case "gender": {
        const p = [...visits.params];
        p[1] = tz;
        p[2] = from;
        p[3] = to;
        const rows = await query<{ g: string | null; n: number }>(
          `select pp.gender as g, count(*)::int as n from people pp
            where pp.id in (select c.person_id from check_ins c where ${visits.where} and c.deleted_at is null)
            group by pp.gender order by n desc`,
          p,
        );
        const total = rows.reduce((a, r) => a + r.n, 0);
        out.push({ key, value: total, prev: 0, series: [], parts: rows.slice(0, 6).map((r) => ({ label: r.g || "Not recorded", value: r.n })) });
        break;
      }
    }
  }
  // Say plainly when a filter can't apply to a tile, instead of showing unfiltered numbers as filtered.
  const anyFilter = Boolean(f.memberId || f.serviceId || f.program);
  for (const tile of out) {
    const skip =
      (tile.key === "automation_runs" && anyFilter) ||
      (Boolean(f.serviceId) && (tile.key === "new_people" || tile.key === "exits" || tile.key === "form_responses"));
    if (skip) tile.note = [tile.note, tile.key === "automation_runs" ? "Filters don't apply here" : "Not filtered by service"].filter(Boolean).join(" · ");
  }
  return out;
}
