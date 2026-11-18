"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateCheckInSafe } from "@/lib/actions/check-ins";
import { saveServicePeopleAsList, type ServiceRecipient } from "@/lib/actions/service-people";
import { fromLocalInputValue, toLocalInputValue } from "@/components/check-ins/time";
import { formatMoney } from "@/lib/money";

/** Everyone who got a service, with the date (editable), and "save these people as a list or group". */
export function ServicePeople({
  serviceId,
  serviceName,
  from,
  to,
  tz,
  rows,
  showLoggedBy,
}: {
  serviceId: string;
  serviceName: string;
  from: string;
  to: string;
  tz: string;
  rows: ServiceRecipient[];
  showLoggedBy: boolean;
}) {
  const router = useRouter();
  const people = new Set(rows.map((r) => r.personId)).size;
  const [name, setName] = useState(`${serviceName} · ${from} to ${to}`);
  const [kind, setKind] = useState<"list" | "group">("group");
  const [saved, setSaved] = useState<{ listId: string; count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      setError(null);
      const r = await saveServicePeopleAsList({ serviceId, from, to, tz, name, isGroup: kind === "group" });
      if (!r.ok) return setError(r.error);
      setSaved(r.data);
    });

  return (
    <div className="space-y-6">
      <section className="card space-y-3 p-4">
        <h2 className="text-sm font-semibold text-text">Save these {people.toLocaleString()} people</h2>
        {saved ? (
          <p className="text-sm text-accent">
            Saved {saved.count.toLocaleString()} {saved.count === 1 ? "person" : "people"}.{" "}
            <Link href={`/lists/${saved.listId}`} className="font-semibold underline">
              Open the {kind}
            </Link>
          </p>
        ) : (
          <>
            <p className="text-xs text-text-muted">
              Make a group (to check people in together, or follow up with all of them) or a list of everyone who got this service in these dates.
              Each person is added once.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className="input min-w-0 flex-1" aria-label="Name" />
              <select value={kind} onChange={(e) => setKind(e.target.value as "list" | "group")} className="input w-auto" aria-label="Group or list">
                <option value="group">As a group</option>
                <option value="list">As a list</option>
              </select>
              <button
                type="button"
                onClick={save}
                disabled={pending || people === 0}
                className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg hover:bg-accent-dim disabled:opacity-50"
              >
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
            {error && <p className="text-xs text-danger">{error}</p>}
          </>
        )}
      </section>

      {rows.length === 0 ? (
        <div className="card p-4 text-sm text-text-muted">Nobody got this service in these dates.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="eyebrow border-b border-border text-left text-text-faint">
                <th className="px-4 py-2 font-semibold">Person</th>
                <th className="px-3 py-2 font-semibold">Date</th>
                <th className="px-3 py-2 text-right font-semibold">Amount</th>
                {showLoggedBy && <th className="px-4 py-2 font-semibold">Logged by</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {rows.map((r) => (
                <tr key={r.checkInId}>
                  <td className="px-4 py-2">
                    <Link href={`/people/${r.personId}`} className="text-text hover:text-accent hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-3 py-1.5">
                    <DateCell checkInId={r.checkInId} at={r.at} onSaved={() => router.refresh()} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-text-muted">{r.amountCents ? formatMoney(r.amountCents) : "–"}</td>
                  {showLoggedBy && <td className="px-4 py-2 text-text-muted">{r.loggedBy ?? ""}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** The date and time it was provided; change it and it saves (same rules as editing a check-in). */
function DateCell({ checkInId, at, onSaved }: { checkInId: string; at: string; onSaved: () => void }) {
  const [value, setValue] = useState(() => toLocalInputValue(at));
  const [saved, setSaved] = useState(value);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const save = async () => {
    if (value === saved) return;
    const iso = fromLocalInputValue(value);
    if (!iso) return setState("error");
    setState("saving");
    const r = await updateCheckInSafe(checkInId, { checkedInAt: iso });
    if (!r.ok) return setState("error");
    setSaved(value);
    setState("saved");
    onSaved();
  };
  return (
    <span className="inline-flex items-center gap-2">
      <input
        type="datetime-local"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        aria-label="Date provided"
        className="input w-auto py-1 text-sm tabular-nums"
      />
      {state === "saving" && <span className="text-xs text-text-muted">Saving…</span>}
      {state === "saved" && <span className="text-xs text-accent">Saved</span>}
      {state === "error" && <span className="text-xs text-danger">Couldn&apos;t save</span>}
    </span>
  );
}
