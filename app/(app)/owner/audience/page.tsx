import type { Metadata } from "next";
import { requireOwner } from "@/lib/owner";
import { OwnerNav, Tile, pct } from "@/components/owner/OwnerNav";
import { activation, cohorts, featureUse, whereFrom, whoSignsUp } from "@/lib/owner-stats";
import { SOLO_USES } from "@/lib/setup";

export const metadata: Metadata = { title: "Audience · Command center", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Who signs up, who sticks, and what they use. Counts only, never anyone's client records. */
export default async function OwnerAudiencePage() {
  await requireOwner();
  const [who, act, weeks, use, from] = await Promise.all([whoSignsUp(), activation(), cohorts(), featureUse(), whereFrom()]);
  const useLabel = (v: string) => SOLO_USES.find((u) => u.value === v)?.label ?? v;
  const users = use?.users ?? 0;
  const orgs = use?.orgs ?? 0;
  const features: { label: string; n: number; of: number; unit: string }[] = [
    { label: "Front-desk kiosk", n: use?.kiosk ?? 0, of: users, unit: "accounts" },
    { label: "Referral link", n: use?.referral ?? 0, of: orgs, unit: "organizations" },
    { label: "Outcomes recorded", n: use?.outcomes ?? 0, of: users, unit: "accounts" },
    { label: "Voice commands", n: use?.voice ?? 0, of: users, unit: "accounts" },
    { label: "AI (command bar, summaries)", n: use?.ai ?? 0, of: users, unit: "accounts" },
    { label: "Calendar sync", n: use?.calendar ?? 0, of: users, unit: "accounts" },
    { label: "Downloaded a report", n: use?.reports ?? 0, of: users, unit: "accounts" },
    { label: "Organization report made", n: use?.org_reports ?? 0, of: orgs, unit: "organizations" },
    { label: "10+ people added", n: use?.import_people ?? 0, of: users, unit: "accounts" },
  ];

  return (
    <div className="max-w-3xl space-y-8">
      <OwnerNav active="/owner/audience" title="Audience" intro="Who signs up, who sticks around, and which features they use. Counts only." />

      <section className="space-y-3">
        <h2 className="section-label">Activation</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Activated" value={pct(act?.activated ?? 0, act?.total ?? 0)} note="3+ people and a check-in in week one" />
          <Tile label="Added 3+ people" value={pct(act?.added3 ?? 0, act?.total ?? 0)} />
          <Tile label="Logged a check-in" value={pct(act?.checked_in ?? 0, act?.total ?? 0)} />
          <Tile label="Accounts counted" value={String(act?.total ?? 0)} note="Signed up 7–90 days ago" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="section-label">Who signs up (90 days)</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Counts title="Account type" rows={who.types} />
          <Counts title="Individuals use it for" rows={who.uses.map((r) => ({ ...r, label: useLabel(r.label) }))} />
          <Counts title="Organization size (from set-up)" rows={who.sizes} />
          <Counts title="Device at sign-up" rows={from.devices} />
          <Counts title="Most common services" rows={who.services} />
          <Counts title="Most common outcomes" rows={who.outcomes} />
          <Counts title="Time zone (rough region)" rows={from.zones} />
        </div>
        <p className="text-xs text-text-faint">Likely bot sign-ups excluded. Device counting started Nov 15, 2026.</p>
      </section>

      <section className="space-y-3">
        <h2 className="section-label">Still coming back (by sign-up week)</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="eyebrow border-b border-border text-left text-text-faint">
                <th className="px-4 py-2 font-semibold">Week of</th>
                <th className="px-3 py-2 text-right font-semibold">Sign-ups</th>
                <th className="px-3 py-2 text-right font-semibold">After 1 wk</th>
                <th className="px-3 py-2 text-right font-semibold">After 2 wks</th>
                <th className="px-4 py-2 text-right font-semibold">After 4 wks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {weeks.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-text-muted">No sign-ups in the last 8 weeks.</td>
                </tr>
              )}
              {weeks.map((w) => (
                <tr key={w.week}>
                  <td className="px-4 py-2 text-text">{w.week}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{w.size}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{w.w1 === null ? "…" : pct(w.w1, w.size)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{w.w2 === null ? "…" : pct(w.w2, w.size)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{w.w4 === null ? "…" : pct(w.w4, w.size)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-text-faint">Share whose latest sign-in came at least 1, 2 or 4 weeks after they signed up. &ldquo;…&rdquo; = too soon to tell.</p>
      </section>

      <section className="space-y-3">
        <h2 className="section-label">Feature use (all time)</h2>
        <div className="card space-y-2 p-4 text-sm">
          {features.map((f) => (
            <div key={f.label} className="flex items-center gap-3">
              <span className="w-48 shrink-0 text-text">{f.label}</span>
              <div className="progress-bar h-2 flex-1">
                <span style={{ width: f.of ? `${Math.round((f.n / f.of) * 100)}%` : "0%" }} />
              </div>
              <span className="w-28 shrink-0 text-right tabular-nums text-text-muted">
                {pct(f.n, f.of)} · {f.n} {f.unit === "organizations" ? "orgs" : ""}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Counts({ title, rows }: { title: string; rows: { label: string; n: number }[] }) {
  const total = rows.reduce((s, r) => s + r.n, 0);
  return (
    <div className="card space-y-2 p-4 text-sm">
      <p className="eyebrow text-text-faint">{title}</p>
      {rows.length === 0 && <p className="text-text-muted">Nothing yet.</p>}
      {rows.map((r) => (
        <div key={r.label} className="flex justify-between gap-3">
          <span className="truncate text-text">{r.label}</span>
          <span className="shrink-0 tabular-nums text-text-muted">
            {r.n} · {pct(r.n, total)}
          </span>
        </div>
      ))}
    </div>
  );
}
