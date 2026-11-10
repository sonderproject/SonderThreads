import Link from "next/link";
import { notFound } from "next/navigation";
import { getMembership } from "@/lib/org";
import { getTimeZone } from "@/lib/timezone";
import { shortDate } from "@/lib/team";
import {
  STATUS_LABELS,
  findLikelyMatches,
  formatDob,
  listReferralDepartments,
  listReferrals,
  type ReferralRow,
} from "@/lib/referrals";
import { acceptReferral, declineReferral, matchReferral } from "@/lib/actions/referrals";

const SAVED: Record<string, string> = {
  accepted: "Accepted. The client was added to the organization.",
  matched: "Added to the existing client.",
  declined: "Declined. It stays in the log.",
};
const ERRORS: Record<string, string> = {
  gone: "That referral was already handled.",
  match: "That client couldn't be found.",
};
const STATUS_TONE: Record<string, string> = { new: "tag-e", accepted: "tag-n", matched: "tag-v", declined: "tag-u" };

const btn = "rounded-full border border-border px-3 py-1.5 text-sm font-medium text-text hover:bg-bg-hover";

function timeOf(v: string, timeZone: string): string {
  return new Date(v).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone });
}

/** Admins: new referrals to accept (Inbox) and every referral ever sent (Log). */
export default async function ReferralsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; dept?: string; from?: string; to?: string; saved?: string; error?: string; person?: string }>;
}) {
  const m = await getMembership();
  if (!m?.active || m.role !== "admin") notFound();
  const sp = await searchParams;
  const tab = sp.tab === "log" ? "log" : "inbox";
  const tz = await getTimeZone();
  const filters = { dept: sp.dept || null, from: sp.from || null, to: sp.to || null };

  const [waiting, log, departments] = await Promise.all([
    listReferrals(m.orgId, {}, "new"),
    tab === "log" ? listReferrals(m.orgId, filters) : Promise.resolve([] as ReferralRow[]),
    tab === "log" ? listReferralDepartments(m.orgId) : Promise.resolve([] as string[]),
  ]);
  const matches = tab === "inbox" ? await Promise.all(waiting.map((r) => findLikelyMatches(m.orgId, r))) : [];

  const byDept = new Map<string, number>();
  for (const r of log) {
    const k = r.referrer_department.trim();
    const key = [...byDept.keys()].find((x) => x.toLowerCase() === k.toLowerCase()) ?? k;
    byDept.set(key, (byDept.get(key) ?? 0) + 1);
  }
  const becameClients = log.filter((r) => r.status === "accepted" || r.status === "matched").length;
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="eyebrow text-text-faint">{m.orgName}</p>
        <h1 className="page-title">Referrals</h1>
        <p className="text-sm text-text-muted">
          Sent in through your referral link.{" "}
          <Link href="/organization#referrals" className="text-accent hover:underline">
            Get the link →
          </Link>
        </p>
      </div>

      <div className="inline-flex rounded-full border border-border bg-bg-raised p-0.5 text-sm" role="group" aria-label="Referrals view">
        <Link
          href="/referrals"
          aria-pressed={tab === "inbox"}
          className={`rounded-full px-4 py-1.5 font-medium ${tab === "inbox" ? "bg-accent text-bg" : "text-text-muted hover:text-text"}`}
        >
          Inbox{waiting.length > 0 && ` (${waiting.length})`}
        </Link>
        <Link
          href="/referrals?tab=log"
          aria-pressed={tab === "log"}
          className={`rounded-full px-4 py-1.5 font-medium ${tab === "log" ? "bg-accent text-bg" : "text-text-muted hover:text-text"}`}
        >
          Log
        </Link>
      </div>

      {sp.error && ERRORS[sp.error] && <p className="flag text-sm">{ERRORS[sp.error]}</p>}
      {sp.saved && SAVED[sp.saved] && (
        <p className="text-sm text-accent">
          {SAVED[sp.saved]}{" "}
          {sp.person && (
            <Link href={`/people/${sp.person}`} className="underline">
              Open client
            </Link>
          )}
        </p>
      )}

      {tab === "inbox" ? (
        waiting.length === 0 ? (
          <div className="card p-6 text-center text-sm text-text-muted">No referrals waiting. New ones show up here and in Notifications.</div>
        ) : (
          <ul className="space-y-3">
            {waiting.map((r, i) => (
              <li key={r.id} id={`r-${r.id}`} className="card scroll-mt-20 space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-lg">
                      {r.first_name} {r.last_name}
                    </p>
                    <p className="text-sm text-text-muted tabular-nums">
                      {r.phone} · born {formatDob(r.dob)}
                    </p>
                  </div>
                  <p className="text-right text-xs text-text-muted">
                    From <span className="text-text">{r.referrer_name}</span>, {r.referrer_department}
                    <br />
                    {shortDate(r.created_at, tz)} · {timeOf(r.created_at, tz)}
                  </p>
                </div>

                {matches[i]?.length > 0 && (
                  <div className="space-y-2 rounded-xl border border-border-subtle p-3">
                    <p className="text-xs font-medium text-text-muted">Might already be a client:</p>
                    {matches[i].map((p) => (
                      <form key={p.id} action={matchReferral} className="flex flex-wrap items-center justify-between gap-2">
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="person_id" value={p.id} />
                        <Link href={`/people/${p.id}`} className="text-sm text-accent hover:underline">
                          {p.display_name}
                          {p.birthday ? ` · born ${formatDob(p.birthday)}` : ""}
                        </Link>
                        <button type="submit" className={btn}>
                          Already a client
                        </button>
                      </form>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <form action={acceptReferral}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-bg hover:bg-accent-dim">
                      Accept as new client
                    </button>
                  </form>
                  <details className="group">
                    <summary className={`${btn} cursor-pointer list-none`}>Decline</summary>
                    <form action={declineReferral} className="mt-2 flex flex-wrap gap-2">
                      <input type="hidden" name="id" value={r.id} />
                      <input name="reason" maxLength={500} placeholder="Reason (optional)" className="input max-w-xs" />
                      <button type="submit" className={btn}>
                        Decline referral
                      </button>
                    </form>
                  </details>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="space-y-4">
          <form className="card flex flex-wrap items-end gap-3 p-4" action="/referrals">
            <input type="hidden" name="tab" value="log" />
            <label className="space-y-1 text-sm">
              <span className="text-text-muted">Department</span>
              <select name="dept" defaultValue={filters.dept ?? ""} className="input">
                <option value="">All</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-text-muted">From</span>
              <input type="date" name="from" defaultValue={filters.from ?? ""} className="input" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-text-muted">To</span>
              <input type="date" name="to" defaultValue={filters.to ?? ""} className="input" />
            </label>
            <button type="submit" className={btn}>
              Filter
            </button>
            <div className="ml-auto flex gap-2">
              <a href={`/api/referrals/export?format=xlsx${qs ? `&${qs}` : ""}`} className={btn}>
                Excel
              </a>
              <a href={`/api/referrals/export?format=csv${qs ? `&${qs}` : ""}`} className={btn}>
                CSV
              </a>
            </div>
          </form>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="card p-4">
              <p className="eyebrow text-text-faint">Referrals</p>
              <p className="font-display text-4xl font-light tabular-nums">{log.length}</p>
            </div>
            <div className="card p-4">
              <p className="eyebrow text-text-faint">Became clients</p>
              <p className="font-display text-4xl font-light tabular-nums">{becameClients}</p>
            </div>
            <div className="card p-4">
              <p className="eyebrow text-text-faint">By department</p>
              <p className="text-sm text-text">
                {byDept.size === 0
                  ? "None yet"
                  : [...byDept.entries()]
                      .sort((a, b) => b[1] - a[1])
                      .map(([d, n]) => `${d}: ${n}`)
                      .join(" · ")}
              </p>
            </div>
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="eyebrow border-b border-border text-left text-text-faint">
                  <th className="px-4 py-2 font-semibold">Sent</th>
                  <th className="px-3 py-2 font-semibold">Client</th>
                  <th className="px-3 py-2 font-semibold">Referred by</th>
                  <th className="px-3 py-2 font-semibold">Department</th>
                  <th className="px-3 py-2 font-semibold">Outcome</th>
                  <th className="px-4 py-2 font-semibold">Handled by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {log.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-text-muted">
                      No referrals{qs ? " match these filters" : " yet"}.
                    </td>
                  </tr>
                )}
                {log.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                      {shortDate(r.created_at, tz)}
                      <span className="block text-xs text-text-muted">{timeOf(r.created_at, tz)}</span>
                    </td>
                    <td className="px-3 py-3">
                      {r.person_id ? (
                        <Link href={`/people/${r.person_id}`} className="text-accent hover:underline">
                          {r.first_name} {r.last_name}
                        </Link>
                      ) : (
                        `${r.first_name} ${r.last_name}`
                      )}
                    </td>
                    <td className="px-3 py-3">{r.referrer_name}</td>
                    <td className="px-3 py-3">{r.referrer_department}</td>
                    <td className="px-3 py-3">
                      <span className={`tag ${STATUS_TONE[r.status]}`}>{STATUS_LABELS[r.status]}</span>
                      {r.decline_reason && <span className="block text-xs text-text-muted">{r.decline_reason}</span>}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {r.handled_by_name ?? "—"}
                      {r.handled_at && <span className="block text-xs">{shortDate(r.handled_at, tz)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
