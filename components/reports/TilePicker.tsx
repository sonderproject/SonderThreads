"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { saveDashboardTiles } from "@/lib/actions/reports";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg hover:bg-accent-dim disabled:opacity-50">
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

/** "Customize": pick which tiles show on your dashboard (saved for you only). */
export function TilePicker({ options, selected, back }: { options: { key: string; label: string; hint: string }[]; selected: string[]; back: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="w-full sm:w-auto">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="rounded-full border border-border px-4 py-2 text-sm font-medium text-text hover:bg-bg-hover">
        Customize
      </button>
      {open && (
        <form
          action={async (fd) => {
            const r = await saveDashboardTiles(fd.getAll("tiles").map(String));
            if (r.ok) window.location.assign(back);
          }}
          className="card mt-2 space-y-3 p-4"
        >
          <input type="hidden" name="back" value={back} />
          <p className="section-label">Tiles on your dashboard</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {options.map((o) => (
              <li key={o.key}>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border-subtle p-2.5 text-sm has-[:checked]:border-accent">
                  <input type="checkbox" name="tiles" value={o.key} defaultChecked={selected.includes(o.key)} className="mt-0.5 accent-[var(--color-accent)]" />
                  <span>
                    <span className="block font-medium text-text">{o.label}</span>
                    <span className="block text-xs text-text-muted">{o.hint}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <SaveButton />
            <button type="button" onClick={() => setOpen(false)} className="rounded-full px-3 py-2 text-sm text-text-muted hover:text-text">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
