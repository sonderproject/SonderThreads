"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createCheckInSafe } from "@/lib/actions/check-ins";
import { createPersonRecordSafe } from "@/lib/actions/people";
import { fromLocalInputValue, toLocalInputValue } from "./time";
import type { Person } from "@/lib/types";
import { NAME_INPUT, PROSE_INPUT } from "@/lib/input-props";
import { parseMoney } from "@/lib/money";
import type { Service } from "@/lib/services";

const NEW_PERSON = "__new__";

/**
 * Logs a check-in. With `personId` set (on a profile) the person picker is
 * hidden; otherwise you pick someone or add a new person inline.
 */
export function CheckInForm({
  people = [],
  personId: fixedPersonId,
  reasons,
  services = [],
}: {
  people?: Pick<Person, "id" | "display_name">[];
  personId?: string;
  reasons: string[];
  /** Settings → Services. When set, one tap picks a service instead of typing a reason. */
  services?: Service[];
}) {
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const service = services.find((s) => s.id === serviceId) ?? null;
  const showAmount = services.some((s) => s.priceCents !== null);
  function pickService(s: Service) {
    if (serviceId === s.id) {
      setServiceId(null);
      setAmount("");
      return;
    }
    setServiceId(s.id);
    setReason("");
    setAmount(s.priceCents === null ? "" : (s.priceCents / 100).toFixed(s.priceCents % 100 ? 2 : 0));
  }
  const [personId, setPersonId] = useState("");
  const [newName, setNewName] = useState("");
  const [when, setWhen] = useState(() => toLocalInputValue(new Date()));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const creatingPerson = !fixedPersonId && personId === NEW_PERSON;
  const canSubmit = fixedPersonId || (creatingPerson ? newName.trim() : personId);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSaved(null);
    startTransition(async () => {
      let id = fixedPersonId ?? personId;
      let name = people.find((p) => p.id === id)?.display_name;
      if (creatingPerson) {
        const created = await createPersonRecordSafe({ fullName: newName });
        if (!created.ok) return setError(created.error);
        id = created.data.id;
        name = created.data.display_name;
      }
      const cents = parseMoney(amount);
      if (cents !== null && Number.isNaN(cents)) return setError("Enter an amount like 45 or 45.50.");
      const result = await createCheckInSafe({
        personId: id,
        checkedInAt: fromLocalInputValue(when),
        reason: service ? null : reason || null,
        serviceId: service?.id ?? null,
        amountCents: cents,
      });
      if (!result.ok) return setError(result.error);
      setPersonId("");
      setNewName("");
      setReason("");
      setServiceId(null);
      setAmount("");
      setWhen(toLocalInputValue(new Date()));
      setSaved(name ? `${name} checked in.` : "Checked in.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 card p-3">
      {error && <p className="text-xs text-danger">{error}</p>}
      {saved && <p className="text-xs text-accent">{saved}</p>}

      {!fixedPersonId && (
        <div className="space-y-2">
          <label className="block">
            <span className="eyebrow mb-1 block text-text-faint">Person</span>
            <select
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
              className="input"
              required
            >
              <option value="">Choose a person...</option>
              <option value={NEW_PERSON}>+ New person</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name}
                </option>
              ))}
            </select>
          </label>
          {creatingPerson && (
            <input
              {...NAME_INPUT}
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Full name"
              className="input"
            />
          )}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
        <label className="block">
          <span className="eyebrow mb-1 block text-text-faint">Date &amp; time</span>
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="input tabular-nums"
            required
          />
        </label>
        <label className="block">
          <span className="eyebrow mb-1 block text-text-faint">{services.length ? "Service or reason" : "Reason"}</span>
          <input
            {...PROSE_INPUT}
            value={service ? service.name : reason}
            onChange={(e) => {
              setServiceId(null);
              setReason(e.target.value);
            }}
            placeholder={services.length ? "Pick a service below, or type a reason" : "Why they checked in..."}
            maxLength={500}
            className="input"
          />
        </label>
      </div>

      {services.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Services">
          {services.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={serviceId === s.id}
              onClick={() => pickService(s)}
              className={`rounded-full border px-2.5 py-1 text-xs ${
                serviceId === s.id
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border text-text hover:border-accent hover:text-accent"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {service && showAmount && (
        <label className="block max-w-[12rem]">
          <span className="eyebrow mb-1 block text-text-faint">Amount</span>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0" className="input tabular-nums" />
        </label>
      )}

      {services.length === 0 && reasons.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {reasons.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={`rounded-full border px-2 py-0.5 text-xs ${
                reason === r
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border text-text-muted hover:border-accent hover:text-accent"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending || !canSubmit}>
          {pending ? "Saving..." : "Check in"}
        </Button>
      </div>
    </form>
  );
}
