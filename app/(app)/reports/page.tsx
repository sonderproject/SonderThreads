import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/reports/ActionForm";
import { TileCard } from "@/components/reports/TileCard";
import { TilePicker } from "@/components/reports/TilePicker";
import { ConfirmSubmit } from "@/components/ui/ConfirmSubmit";
import { computeTiles } from "@/lib/dashboard";
import { RANGES, REPORT_LIMITS, WEEKDAYS, rangeFor, rangeLabel, tilesFor, type TileKey } from "@/lib/dashboard-shared";
import { dashboardTiles, filterChoices, listSchedules, reportAccess, type ScheduleView } from "@/lib/reports";
import { deleteSchedule, saveSchedule, sendScheduleNow, setScheduleEnabled } from "@/lib/actions/reports";
import { termsFor } from "@/lib/terms";
import { dayKey } from "@/lib/tz";

export const metadata = { title: "Reports" };

const SAVED: Record<string, string> = {
  schedule: "Schedule saved.",
  paused: "Paused. No emails until you resume it.",
  resumed: "Resumed.",
  deleted: "Schedule deleted.",
  sent: "Sent to your email. Check your inbox in a minute.",
};
const ERRORS: Record<string, string> = {
  limit: `You can have up to ${REPORT_LIMITS.schedulesPerAccount} schedules.`,
  gone: "That schedule no longer exists.",
  busy: "Too many reports in a short time. Try again in a little while.",
  send: "That report couldn't be sent. Try again in a minute.",
};
const btn = "rounded-full border border-border px-4 py-2 text-sm font-medium text-text hover:bg-bg-hover";
const primary = "rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg hover:bg-accent-dim";
const hourLabel = (h: number) => `${h % 12 || 12}${h < 12 ? " a.m." : " p.m."}`;

type SP = { tab?: string; range?: string; from?: string; to?: string; member?: string; service?: string; program?: string; compare?: string; saved?: string; error?: string };

/** Reports: a dashboard you set up, and reports emailed on a schedule. Counts only. */
export default async function ReportsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const a = await reportAccess();
  if (!a) notFound();
  const sp = await searchParams;
  const tab = sp.tab === "scheduled" ? "scheduled" : "dashboard";
  const terms = termsFor(a.audience);
  const options = tilesFor(a.audience).map((t) => ({ key: t.key, label: t.label({ checkIns: terms.checkIns }), hint: t.hint }));

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p className="eyebrow text-text-faint">{a.orgName ?? "Your numbers"}</p>
        <h1 className="page-title">Reports</h1>
        <p className="text-sm text-text-muted">
          Your numbers at a glance, and emailed to you on schedule. For the full story with charts and the PDF, open{" "}
          <Link href="/impact" className="text-accent hover:underline">
            {terms.impact}
          </Link>
          .
        </p>
      </div>
      <nav className="inline-flex rounded-full border border-border bg-bg-raised p-0.5 text-sm" aria-label="Reports sections">
        {(
          [
            ["dashboard", "Dashboard"],
            ["scheduled", "Scheduled"],
          ] as const
        ).map(([k, label]) => (
          <Link key={k} href={`/reports${k === "scheduled" ? "?tab=scheduled" : ""}`} aria-current={tab === k ? "page" : undefined} className={`rounded-full px-4 py-1.5 ${tab === k ? "bg-accent text-bg" : "text-text-muted hover:text-text"}`}>
            {label}
          </Link>
        ))}
      </nav>
      {sp.saved && SAVED[sp.saved] && <p className="rounded-xl bg-accent-soft p-3 text-sm text-accent">{SAVED[sp.saved]}</p>}
      {sp.error && ERRORS[sp.error] && <p className="flag rounded-xl p-3 text-sm">{ERRORS[sp.error]}</p>}
      {tab === "dashboard" ? <Dashboard a={a} sp={sp} options={options} checkIns={terms.checkIns} /> : <Scheduled a={a} options={options} />}
    </div>
  );
}

async function Dashboard({ a, sp, options, checkIns }: { a: NonNullable<Awaited<ReturnType<typeof reportAccess>>>; sp: SP; options: { key: string; label: string; hint: string }[]; checkIns: string }) {
  const today = dayKey(new Date(), a.tz);
  const range = rangeFor(sp.range, today, sp.from, sp.to);
  const compare = sp.compare !== "0";
  const [tiles, choices] = await Promise.all([dashboardTiles(a), filterChoices(a)]);
  const [fieldId, ...valueParts] = (sp.program ?? "").split(":");
  const program = fieldId && valueParts.length ? { fieldId, value: valueParts.join(":") } : null;
  const data = await computeTiles(a.scope, a.tz, range.from, range.to, tiles, { memberId: sp.member || null, serviceId: sp.service || null, program });
  const filtered = Boolean(sp.member || sp.service || sp.program);

  return (
    <div className="space-y-4">
      <form className="card flex flex-wrap items-end gap-3 p-4 [&>*]:min-w-[11rem] [&>*]:flex-1">
        <label className="space-y-1 text-sm">
          <span className="text-text-muted">Period</span>
          <select name="range" defaultValue={range.key} className="input">
            {RANGES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        {range.key === "custom" && (
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-sm">
              <span className="text-text-muted">From</span>
              <input type="date" name="from" defaultValue={range.from} max={today} className="input tabular-nums" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-text-muted">To</span>
              <input type="date" name="to" defaultValue={range.to} max={today} className="input tabular-nums" />
            </label>
          </div>
        )}
        {choices.members.length > 0 && (
          <label className="space-y-1 text-sm">
            <span className="text-text-muted">Member</span>
            <select name="member" defaultValue={sp.member ?? ""} className="input">
              <option value="">Everyone</option>
              {choices.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {choices.services.length > 0 && (
          <label className="space-y-1 text-sm">
            <span className="text-text-muted">Service</span>
            <select name="service" defaultValue={sp.service ?? ""} className="input">
              <option value="">All services</option>
              {choices.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {choices.programs.length > 0 && (
          <label className="space-y-1 text-sm">
            <span className="text-text-muted">Program</span>
            <select name="program" defaultValue={sp.program ?? ""} className="input">
              <option value="">All</option>
              {choices.programs.map((p) => (
                <optgroup key={p.id} label={p.label}>
                  {p.options.map((o) => (
                    <option key={o} value={`${p.id}:${o}`}>
                      {o}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        )}
        <div className="flex items-end gap-2 !min-w-0 !flex-none">
          <label className="space-y-1 text-sm">
            <span className="text-text-muted">Compare</span>
            <select name="compare" defaultValue={compare ? "1" : "0"} className="input">
              <option value="1">With the period before</option>
              <option value="0">Don&apos;t compare</option>
            </select>
          </label>
          <button className={primary}>Apply</button>
        </div>
      </form>
      <p className="text-xs text-text-faint">Pick Custom and Apply to choose your own dates.</p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-muted">
          {rangeLabel(range.from, range.to)}
          {filtered && " · filtered"}
          {filtered && (
            <>
              {" "}
              <Link href={`/reports?range=${range.key}&from=${range.from}&to=${range.to}`} className="text-accent hover:underline">
                Clear filters
              </Link>
            </>
          )}
        </p>
        <TilePicker key={tiles.join(",")} options={options} selected={tiles} back={`/reports?${new URLSearchParams(Object.entries({ range: range.key, from: range.key === "custom" ? range.from : "", to: range.key === "custom" ? range.to : "", member: sp.member ?? "", service: sp.service ?? "", program: sp.program ?? "", compare: sp.compare ?? "" }).filter(([, v]) => v) as [string, string][])}`} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((t) => (
          <TileCard key={t.key} tile={t} checkIns={checkIns} compare={compare} />
        ))}
      </div>
      <p className="text-xs text-text-faint">Tasks are private, so they never appear in reports. Revenue counts priced services logged on visits.</p>
    </div>
  );
}

async function Scheduled({ a, options }: { a: NonNullable<Awaited<ReturnType<typeof reportAccess>>>; options: { key: string; label: string; hint: string }[] }) {
  const schedules = await listSchedules(a);
  const isOrg = Boolean(a.scope.orgId);
  const form = (s?: ScheduleView) => (
    <ActionForm action={saveSchedule} className="space-y-3">
      {s && <input type="hidden" name="id" value={s.id} />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-sm sm:col-span-2 lg:col-span-1">
          <span className="text-text-muted">Name</span>
          <input name="name" defaultValue={s?.name ?? "Weekly report"} maxLength={REPORT_LIMITS.nameLength} className="input" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-text-muted">How often</span>
          <select name="frequency" defaultValue={s?.frequency ?? "weekly"} className="input">
            <option value="weekly">Every week (the last 7 days)</option>
            <option value="monthly">Every month (the month before)</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-sm">
            <span className="text-text-muted">Weekly on</span>
            <select name="weekday" defaultValue={s?.weekday ?? 1} className="input">
              {WEEKDAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-text-muted">Monthly on day</span>
            <select name="month_day" defaultValue={s?.monthDay ?? 1} className="input">
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="space-y-1 text-sm">
          <span className="text-text-muted">At</span>
          <select name="hour" defaultValue={s?.hour ?? 8} className="input">
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {hourLabel(h)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {isOrg && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-text-muted">Send to</span>
            <select name="recipients" defaultValue={s?.recipients ?? "me"} className="input">
              <option value="me">Only me</option>
              <option value="managers">All Admins and Managers</option>
            </select>
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" name="attach_pdf" value="1" defaultChecked={s?.attachPdf ?? false} className="accent-[var(--color-accent)]" />
            Attach the PDF report
          </label>
        </div>
      )}
      <fieldset className="space-y-2">
        <legend className="text-sm text-text-muted">Numbers in the email</legend>
        <div className="flex flex-wrap gap-2">
          {options.map((o) => (
            <label key={o.key} className="flex cursor-pointer items-center gap-2 rounded-full border border-border-subtle px-3 py-1.5 text-sm has-[:checked]:border-accent has-[:checked]:text-accent">
              <input type="checkbox" name="tiles" value={o.key} defaultChecked={s ? s.tiles.includes(o.key as TileKey) : true} className="accent-[var(--color-accent)]" />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>
      <button className={primary}>{s ? "Save changes" : "Create schedule"}</button>
    </ActionForm>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">
        Reports go out in {isOrg ? "your organization's" : "your"} time zone ({a.tz.replace(/_/g, " ")}). They hold counts only, never client names or notes, and only go to{" "}
        {isOrg ? "you or your organization's Admins and Managers" : "you"}.
      </p>
      {schedules.map((s) => (
        <div key={s.id} className="card space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-text">
                {s.name} <span className={`tag ml-1 ${s.enabled ? "tag-v" : ""}`}>{s.enabled ? "On" : "Paused"}</span>
              </p>
              <p className="text-sm text-text-muted">
                {s.frequency === "weekly" ? `Every ${WEEKDAYS[s.weekday]}` : `Monthly on day ${s.monthDay}`} at {hourLabel(s.hour)} ·{" "}
                {s.recipients === "managers" ? "to all Admins and Managers" : `to ${s.ownerName ?? "the owner"}`}
                {s.attachPdf ? " · with PDF" : ""}
              </p>
              <p className="text-xs text-text-faint">
                {s.lastSent ? `Last sent ${new Date(s.lastSent).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: a.tz })}` : "Not sent yet"}
                {s.lastStatus === "failed" ? " · last try failed" : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionForm action={sendScheduleNow}>
                <input type="hidden" name="id" value={s.id} />
                <button className={btn}>Send me one now</button>
              </ActionForm>
              <ActionForm action={setScheduleEnabled}>
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="enabled" value={s.enabled ? "0" : "1"} />
                <button className={btn}>{s.enabled ? "Pause" : "Resume"}</button>
              </ActionForm>
              <ActionForm action={deleteSchedule}>
                <input type="hidden" name="id" value={s.id} />
                <ConfirmSubmit message="Delete this schedule?" className={`${btn} text-urgent`}>
                  Delete
                </ConfirmSubmit>
              </ActionForm>
            </div>
          </div>
          <details>
            <summary className="cursor-pointer text-sm text-accent">Edit</summary>
            <div className="mt-3">{form(s)}</div>
          </details>
        </div>
      ))}
      {schedules.length < REPORT_LIMITS.schedulesPerAccount && (
        <details className="card p-4" open={schedules.length === 0}>
          <summary className="cursor-pointer font-semibold text-text">New scheduled report</summary>
          <div className="mt-3">{form()}</div>
        </details>
      )}
    </div>
  );
}
