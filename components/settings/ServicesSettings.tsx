"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useTerms } from "@/components/TermsProvider";
import { addService, moveService, setServiceArchived, updateService } from "@/lib/actions/services";
import { formatMoney } from "@/lib/money";
import type { Service } from "@/lib/services";

const priceText = (cents: number | null) => (cents === null ? "" : (cents / 100).toFixed(cents % 100 ? 2 : 0));

/** Settings → Services: the list of what you provide, used when logging check-ins/meetings and in reports. */
export function ServicesSettings({ services, canManage, orgName }: { services: Service[]; canManage: boolean; orgName: string | null }) {
  const terms = useTerms();
  const router = useRouter();
  const active = services.filter((s) => !s.archived);
  const archived = services.filter((s) => s.archived);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return setError(r.error ?? "Something went wrong.");
      after?.();
      router.refresh();
    });
  }

  return (
    <>
      <div className="card space-y-3 p-4">
        <div>
          <h3 className="text-sm font-semibold text-text">What you offer</h3>
          <p className="text-xs text-text-muted">
            Pick one when you log a {terms.checkInLower}, and {terms.impact} shows which services are used most, when, and
            what they bring in. A price is optional.
            {orgName && !canManage ? ` Only ${orgName}'s admins can change this list.` : ""}
          </p>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}

        {active.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-5 text-center text-sm text-text-faint">
            No services yet. {canManage ? "Add your first one below." : ""}
          </p>
        ) : (
          <ul className="divide-y divide-border-subtle rounded-xl border border-border">
            {active.map((s, i) => (
              <ServiceRow
                key={s.id}
                service={s}
                canManage={canManage}
                first={i === 0}
                last={i === active.length - 1}
                pending={pending}
                run={run}
              />
            ))}
          </ul>
        )}

        {canManage && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () => addService({ name, price }),
                () => {
                  setName("");
                  setPrice("");
                },
              );
            }}
            className="flex flex-wrap gap-2"
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input min-w-0 flex-[2_1_10rem]"
              placeholder="Service, e.g. Haircut or Consultation"
              maxLength={80}
              aria-label="New service name"
            />
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="input min-w-0 flex-[1_1_6rem]"
              placeholder="Price (optional)"
              inputMode="decimal"
              aria-label="Price (optional)"
            />
            <Button type="submit" disabled={pending || !name.trim()}>
              Add
            </Button>
          </form>
        )}
      </div>

      {archived.length > 0 && (
        <details className="card p-4 text-sm">
          <summary className="cursor-pointer font-medium text-text">Retired services ({archived.length})</summary>
          <p className="mt-1 text-xs text-text-muted">Kept for past reports. They don&apos;t show when logging.</p>
          <ul className="mt-2 divide-y divide-border-subtle">
            {archived.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-text-muted">{s.name}</span>
                {canManage && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => setServiceArchived(s.id, false))}
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    Bring back
                  </button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

function ServiceRow({
  service,
  canManage,
  first,
  last,
  pending,
  run,
}: {
  service: Service;
  canManage: boolean;
  first: boolean;
  last: boolean;
  pending: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(service.name);
  const [price, setPrice] = useState(priceText(service.priceCents));

  if (editing) {
    return (
      <li className="flex flex-wrap gap-2 p-3">
        <input value={name} onChange={(e) => setName(e.target.value)} className="input min-w-0 flex-[2_1_10rem]" maxLength={80} aria-label="Service name" />
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="input min-w-0 flex-[1_1_6rem]"
          placeholder="Price (optional)"
          inputMode="decimal"
          aria-label="Price"
        />
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={pending || !name.trim()} onClick={() => run(() => updateService(service.id, { name, price }), () => setEditing(false))}>
            Save
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-text">{service.name}</p>
        {service.priceCents !== null && <p className="text-xs tabular-nums text-text-muted">{formatMoney(service.priceCents)}</p>}
      </div>
      {canManage && (
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            disabled={pending || first}
            onClick={() => run(() => moveService(service.id, -1))}
            aria-label={`Move ${service.name} up`}
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-bg-hover disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            disabled={pending || last}
            onClick={() => run(() => moveService(service.id, 1))}
            aria-label={`Move ${service.name} down`}
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-bg-hover disabled:opacity-30"
          >
            ↓
          </button>
          <button type="button" onClick={() => setEditing(true)} className="rounded-full px-2.5 py-1 text-xs font-medium text-accent hover:bg-bg-hover">
            Edit
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setServiceArchived(service.id, true))}
            className="rounded-full px-2.5 py-1 text-xs font-medium text-text-muted hover:bg-bg-hover"
          >
            Retire
          </button>
        </div>
      )}
    </li>
  );
}
