"use client";

import { useId, useMemo, useRef, useState } from "react";
import { fuzzyFilter } from "@/lib/fuzzy";
import { NAME_INPUT } from "@/lib/input-props";

export type PickerOption = { id: string; label: string; hint?: string };

/**
 * Type-to-find dropdown. Shows the best matches as you type (typo-tolerant),
 * picks with click, tap or arrow keys + Enter, and can offer a
 * "+ Add “…”" row for something that isn't in the list yet.
 * The input clears and keeps focus after a pick, for adding several in a row.
 */
export function SearchPicker({
  options,
  onPick,
  onCreate,
  createLabel = (q) => `+ Add “${q}”`,
  placeholder,
  disabled,
  autoFocus,
  emptyMessage = "No matches",
}: {
  options: PickerOption[];
  onPick: (option: PickerOption) => void | Promise<void>;
  onCreate?: (text: string) => void | Promise<void>;
  createLabel?: (text: string) => string;
  placeholder: string;
  disabled?: boolean;
  autoFocus?: boolean;
  emptyMessage?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const q = query.trim();
  const matches = useMemo(
    () => fuzzyFilter(options, q, (o) => [o.label], 8),
    [options, q],
  );
  const exact = matches.some((m) => m.label.toLowerCase() === q.toLowerCase());
  const showCreate = Boolean(onCreate && q && !exact);
  const rows = matches.length + (showCreate ? 1 : 0);

  async function choose(index: number) {
    if (index < matches.length) await onPick(matches[index]);
    else if (showCreate && onCreate) await onCreate(q);
    else return;
    setQuery("");
    setActive(0);
    inputRef.current?.focus();
  }

  return (
    <div className="relative">
      <input
        {...NAME_INPUT}
        ref={inputRef}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoFocus={autoFocus}
        disabled={disabled}
        value={query}
        placeholder={placeholder}
        className="input"
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, Math.max(rows - 1, 0)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (rows > 0) choose(active);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && (rows > 0 || q) && (
        <div
          id={listId}
          role="listbox"
          className="absolute inset-x-0 z-30 mt-1 max-h-72 overflow-y-auto rounded border border-border bg-bg-raised shadow-lg"
        >
          {matches.map((o, i) => (
            <button
              key={o.id}
              type="button"
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(i)}
              className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm ${
                i === active ? "bg-bg-hover text-text" : "text-text"
              }`}
            >
              <span className="truncate">{o.label}</span>
              {o.hint && <span className="shrink-0 text-xs text-text-muted">{o.hint}</span>}
            </button>
          ))}
          {showCreate && (
            <button
              type="button"
              role="option"
              aria-selected={active === matches.length}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(matches.length)}
              onClick={() => choose(matches.length)}
              className={`block w-full border-t border-border-subtle px-3 py-2.5 text-left text-sm font-semibold text-accent ${
                active === matches.length ? "bg-bg-hover" : ""
              }`}
            >
              {createLabel(q)}
            </button>
          )}
          {rows === 0 && <p className="px-3 py-2.5 text-sm text-text-muted">{emptyMessage}</p>}
        </div>
      )}
    </div>
  );
}
