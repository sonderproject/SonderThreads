import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkflowBuilder } from "@/components/automations/WorkflowBuilder";
import { ConfirmSubmit } from "@/components/ui/ConfirmSubmit";
import { builderData, getWorkflow, skippedCount, workflowRuns, workflowScope } from "@/lib/workflows";
import { deleteWorkflow, setWorkflowEnabled } from "@/lib/actions/workflows";
import { getTimeZone } from "@/lib/timezone";
import type { Trigger, TriggerType } from "@/lib/workflows-shared";

export const metadata = { title: "Automation" };

const STATUS: Record<string, { label: string; tone: string }> = {
  done: { label: "Done", tone: "tag-v" },
  failed: { label: "Failed", tone: "tag-u" },
  capped: { label: "Daily limit", tone: "tag-e" },
};
const btn = "rounded-full border border-border px-4 py-2 text-sm font-medium text-text hover:bg-bg-hover";

export default async function AutomationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const [w, s, tz] = await Promise.all([getWorkflow(id), workflowScope(), getTimeZone()]);
  if (!w) notFound();
  const [data, runs, skipped] = await Promise.all([builderData(s), workflowRuns(w.id), s.canManage ? skippedCount(w.id) : Promise.resolve(0)]);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Link href="/automations" className="text-sm text-text-muted hover:text-text">
          ← Automations
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="page-title truncate">{w.name}</h1>
            <span className={`tag ${w.enabled ? "tag-v" : ""}`}>{w.enabled ? "On" : "Off"}</span>
          </div>
          {s.canManage && (
            <div className="flex gap-2">
              <form action={setWorkflowEnabled}>
                <input type="hidden" name="id" value={w.id} />
                <input type="hidden" name="enabled" value={w.enabled ? "0" : "1"} />
                <button className={w.enabled ? btn : "rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg hover:bg-accent-dim"}>{w.enabled ? "Turn off" : "Turn on"}</button>
              </form>
              <form action={deleteWorkflow}>
                <input type="hidden" name="id" value={w.id} />
                <ConfirmSubmit message="Delete this automation? Things it already did stay." className={`${btn} text-urgent`}>
                  Delete
                </ConfirmSubmit>
              </form>
            </div>
          )}
        </div>
        {w.ownerName && <p className="text-xs text-text-faint">Runs as {w.ownerName} (last saved by them). Checked every 5 minutes.</p>}
      </div>
      {sp.saved === "on" && <p className="rounded-xl bg-accent-soft p-3 text-sm text-accent">On. It acts on what happens from now on.</p>}
      {sp.saved === "off" && <p className="rounded-xl bg-accent-soft p-3 text-sm text-accent">Off. Nothing new will run.</p>}
      {sp.error && <p className="flag rounded-xl p-3 text-sm">Fix this before turning it on: {sp.error}</p>}

      <WorkflowBuilder
        id={w.id}
        initial={{ name: w.name, enabled: w.enabled, workflow: { ...w.workflow, trigger: w.workflow.trigger as Partial<Trigger> & { type: TriggerType } } }}
        data={data}
        canEdit={s.canManage}
      />

      {s.canManage && (
        <section className="card space-y-3 p-4" aria-labelledby="log">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="log" className="section-label">
              Run log
            </h2>
            {skipped > 0 && <span className="text-xs text-text-faint">{skipped} didn&apos;t match its conditions in the last 30 days</span>}
          </div>
          {runs.length === 0 ? (
            <p className="text-sm text-text-muted">Nothing yet. Runs show here within 5 minutes of happening.</p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {runs.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                  <span className={`tag ${STATUS[r.status]?.tone ?? ""}`}>{STATUS[r.status]?.label ?? r.status}</span>
                  {r.personId && r.personName ? (
                    <Link href={`/people/${r.personId}`} className="font-medium text-text hover:underline">
                      {r.personName}
                    </Link>
                  ) : (
                    <span className="text-text-muted">A form response</span>
                  )}
                  <span className="order-last w-full text-xs text-text-muted sm:order-none sm:w-auto sm:min-w-0 sm:flex-1 sm:truncate">{r.detail}</span>
                  <span className="text-xs tabular-nums text-text-faint">
                    {new Date(r.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
