"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updatePersonSafe } from "@/lib/actions/people";

/** A dropdown that saves one demographic field the moment it changes. */
export function DemographicSelect({
  personId,
  field,
  value,
  options,
  label,
}: {
  personId: string;
  field: "ethnicity" | "income_level" | "gender";
  value: string | null;
  options: readonly string[];
  label: string;
}) {
  const [current, setCurrent] = useState(value ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function save(next: string) {
    const previous = current;
    setCurrent(next);
    setState("saving");
    setError(null);
    const result = await updatePersonSafe(personId, { [field]: next || null });
    if (result.ok) {
      setState("saved");
      router.refresh();
      setTimeout(() => setState((s) => (s === "saved" ? "idle" : s)), 1500);
    } else {
      setCurrent(previous);
      setState("error");
      setError(result.error);
    }
  }

  return (
    <div>
      <select
        aria-label={label}
        value={current}
        onChange={(e) => save(e.target.value)}
        disabled={state === "saving"}
        className={`-mx-1 w-[calc(100%+0.5rem)] cursor-pointer rounded bg-transparent px-1 py-0.5 text-sm hover:bg-bg-hover ${
          current ? "text-text" : "text-text-muted"
        }`}
      >
        <option value="">Not recorded</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {state === "saved" && <p className="text-[11px] text-accent">Saved</p>}
      {error && <p className="text-[11px] text-danger">{error}</p>}
    </div>
  );
}
