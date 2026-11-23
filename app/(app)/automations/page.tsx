import Link from "next/link";
import { listWorkflows, workflowScope } from "@/lib/workflows";
import { createWorkflow } from "@/lib/actions/workflows";
import { WORKFLOW_TEMPLATES, ACTIONS, TRIGGERS } from "@/lib/workflows-shared";
import { shortDate } from "@/lib/team";
import { getTimeZone } from "@/lib/timezone";

export const metadata = { title: "Automations" };

const ERRORS: Record<string, string> = {
  limit: "You've reached the limit of 25 automations. Delete one to make room.",
  gone: "That automation no longer exists.",
  manage: "Only Admins and Managers can create or change automations.",
};

/** Custom automations: When → If → Then rules that run inside Surfdesk. */
export default async function AutomationsPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string; start?: string }> }) {
  const sp = await searchParams;
  const [s, rows, tz] = await Promise.all([workflowScope(), listWorkflows(), getTimeZone()]);
  const showStarters = s.canManage && (rows.length === 0 || sp.start === "1");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="eyebrow text-text-faint">When → If → Then</p>
          <h1 className="page-title">Automations</h1>
          <p className="text-sm text-text-muted">Let the routine work run itself: tasks, alerts, notes and follow-ups, the moment something happens.</p>
        </div>
        {s.canManage && !showStarters && (
          <Link href="/automations?start=1" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg hover:bg-accent-dim">
            New automation
          </Link>
        )}
      </div>
      {sp.error && ERRORS[sp.error] && <p className="flag rounded-xl p-3 text-sm">{ERRORS[sp.error]}</p>}
      {sp.saved === "deleted" && <p className="rounded-xl bg-accent-soft p-3 text-sm text-accent">Automation deleted.</p>}

      {showStarters && (
        <section className="space-y-3" aria-labelledby="start">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="start" className="section-label">
              Start from a common one
            </h2>
            {rows.length > 0 && (
              <Link href="/automations" className="text-sm text-text-muted hover:text-text">
                Cancel
              </Link>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {WORKFLOW_TEMPLATES.map((t) => (
              <form key={t.key} action={createWorkflow}>
                <input type="hidden" name="template" value={t.key} />
                <button className="card flex h-full w-full flex-col items-start gap-1 p-4 text-left transition-colors hover:bg-bg-hover">
                  <span className="text-sm font-semibold text-text">{t.name}</span>
                  <span className="text-xs text-text-muted">{t.description}</span>
                </button>
              </form>
            ))}
            <form action={createWorkflow}>
              <button className="card flex h-full w-full flex-col items-start gap-1 border-dashed p-4 text-left transition-colors hover:bg-bg-hover">
                <span className="text-sm font-semibold text-text">Build your own</span>
                <span className="text-xs text-text-muted">Pick the trigger, conditions and actions.</span>
              </button>
            </form>
          </div>
          <p className="text-xs text-text-faint">New automations start off. Test one, then turn it on.</p>
        </section>
      )}

      {rows.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rows.map((w) => (
            <li key={w.id}>
              <Link href={`/automations/${w.id}`} className="card block space-y-2 p-4 transition-colors hover:bg-bg-hover">
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0 truncate font-semibold text-text">{w.name}</span>
                  <span className={`tag ${w.enabled ? "tag-v" : ""}`}>{w.enabled ? "On" : "Off"}</span>
                </div>
                <p className="text-sm text-text-muted">
                  {TRIGGERS.find((t) => t.type === w.trigger.type)?.label ?? "Trigger"}
                  {w.conditions.length ? `, if ${w.conditions.length} condition${w.conditions.length === 1 ? " matches" : "s match"}` : ""} →{" "}
                  {w.actions.map((a) => ACTIONS.find((x) => x.type === a.type)?.label.toLowerCase()).join(", ")}
                </p>
                <p className="text-xs text-text-faint">
                  {w.runsWeek} run{w.runsWeek === 1 ? "" : "s"} this week{w.lastRun ? ` · last ${shortDate(w.lastRun, tz)}` : ""}
                  {w.failedWeek ? <span className="text-urgent"> · {w.failedWeek} failed</span> : null}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {rows.length === 0 && !s.canManage && (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-text-muted">No automations yet. An Admin or Manager can set them up.</p>
      )}
      <p className="text-xs text-text-faint">
        Looking for the simple follow-ups (gone quiet, new person, birthdays)?{" "}
        <Link href="/settings/automations" className="text-accent hover:underline">
          They&apos;re in Settings
        </Link>
        .
      </p>
    </div>
  );
}
