"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createCheckInSafe } from "@/lib/actions/check-ins";
import { addService } from "@/lib/actions/services";
import { createPersonRecordSafe } from "@/lib/actions/people";
import { fromLocalInputValue, toLocalInputValue } from "./time";
import type { Person } from "@/lib/types";
import { NAME_INPUT, PROSE_INPUT } from "@/lib/input-props";
import { parseMoney } from "@/lib/money";
import type { Service } from "@/lib/services";

const NEW_PERSON = "__new__";
const NEW_SERVICE = "__new_service__";
const OTHER = "__other__";
const LAST_SERVICE_KEY = "strynd:last-service";

/**
 * Logs a check-in. With `personId` set (on a profile) the person picker is
 * hidden; otherwise you pick someone or add a new person inline.
 */
export function CheckInForm({
  people = [],
  personId: fixedPersonId,
  reasons,
  services: initialServices = [],
  canAddService = false,
}: {
  people?: Pick<Person, "id" | "display_name">[];
  personId?: string;
  reasons: string[];
  /** Settings → Services. When set, one tap picks a service instead of typing a reason. */
  services?: Service[];
  /** Can add to the services list (solo accounts, organization admins). */
  canAddService?: boolean;
}) {
  const [services, setServices] = useState(initialServices);
  const [serviceId, setServiceId] = useState<string | null>(null);
  // "" = nothing picked, a service id, NEW_SERVICE or OTHER.
  const [serviceChoice, setServiceChoice] = useState("");
  const [newServiceName, setNewServiceName] = useState("");
  const [addingService, startAddingService] = useTransition();
  const useServicePicker = services.length > 0 || canAddService;
  const [amount, setAmount] = useState("");
  const service = services.find((s) => s.id === serviceId) ?? null;
  const showAmount = services.some((s) => s.priceCents !== null);
  function pickService(s: Service) {
    setServiceChoice(s.id);
    setServiceId(s.id);
    setReason("");
    setAmount(s.priceCents === null ? "" : (s.priceCents / 100).toFixed(s.priceCents % 100 ? 2 : 0));
  }
  // Most people log the same service all day: preselect the last one used on this device.
  useEffect(() => {
    let last: string | null = null;
    try {
      last = localStorage.getItem(LAST_SERVICE_KEY);
    } catch {
      // storage blocked: just start empty
    }
    const s = last ? initialServices.find((x) => x.id === last) : null;
    if (s) pickService(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function chooseService(value: string) {
    const s = services.find((x) => x.id === value);
    if (s) return pickService(s);
    setServiceChoice(value);
    setServiceId(null);
    setAmount("");
  }
  function saveNewService() {
    const name = newServiceName.trim();
    if (!name) return;
    setError(null);
    startAddingService(async () => {
      const result = await addService({ name });
      if (!result.ok) return setError(result.error);
      setServices((list) => [...list, result.data]);
      setNewServiceName("");
      pickService(result.data);
    });
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
      // Keep the service picked (and remember it) for the next one; clear anything else.
      try {
        if (service) localStorage.setItem(LAST_SERVICE_KEY, service.id);
        else localStorage.removeItem(LAST_SERVICE_KEY);
      } catch {
        // storage blocked: nothing to remember
      }
      if (service) pickService(service);
      else {
        setServiceId(null);
        setServiceChoice("");
        setAmount("");
      }
      setWhen(toLocalInputValue(new Date()));
      setSaved(name ? `${name} checked in.` : "Checked in.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 card p-3">
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      {saved && <p role="status" className="text-xs text-accent">{saved}</p>}

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
        {useServicePicker ? (
          <label className="block">
            <span className="eyebrow mb-1 block text-text-faint">Service</span>
            <select value={serviceChoice} onChange={(e) => chooseService(e.target.value)} className="input">
              <option value="">Choose a service...</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              {canAddService && <option value={NEW_SERVICE}>+ Add new service</option>}
              <option value={OTHER}>Other (type it)</option>
            </select>
          </label>
        ) : (
          <label className="block">
            <span className="eyebrow mb-1 block text-text-faint">Reason</span>
            <input
              {...PROSE_INPUT}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why they checked in..."
              maxLength={500}
              className="input"
            />
          </label>
        )}
      </div>

      {serviceChoice === NEW_SERVICE && (
        <div className="flex gap-2">
          <input
            {...PROSE_INPUT}
            autoFocus
            value={newServiceName}
            onChange={(e) => setNewServiceName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                saveNewService();
              }
            }}
            placeholder="New service name"
            maxLength={80}
            className="input"
          />
          <Button type="button" onClick={saveNewService} disabled={addingService || !newServiceName.trim()}>
            {addingService ? "Adding..." : "Add"}
          </Button>
        </div>
      )}

      {serviceChoice === OTHER && (
        <input
          {...PROSE_INPUT}
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="What was it?"
          maxLength={500}
          className="input"
        />
      )}

      {service && showAmount && (
        <label className="block max-w-[12rem]">
          <span className="eyebrow mb-1 block text-text-faint">Amount</span>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0" className="input tabular-nums" />
        </label>
      )}

      {!useServicePicker && reasons.length > 0 && (
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
