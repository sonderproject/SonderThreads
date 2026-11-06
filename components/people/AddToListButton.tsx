"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SearchPicker } from "@/components/ui/SearchPicker";
import { addPersonToListSafe, createGroupWithPersonSafe } from "@/lib/actions/lists";
import type { List } from "@/lib/types";

/** "+ Add to list" on a profile: pick any list (groups first) or start a new group with this person. */
export function AddToListButton({
  personId,
  lists,
  memberOf,
}: {
  personId: string;
  lists: Pick<List, "id" | "name" | "is_group">[];
  memberOf: string[];
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const joined = new Set(memberOf);
  const options = lists
    .filter((l) => !joined.has(l.id))
    .sort((a, b) => Number(b.is_group) - Number(a.is_group) || a.name.localeCompare(b.name))
    .map((l) => ({ id: l.id, label: l.name, hint: l.is_group ? "group" : undefined }));

  async function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-dashed border-border px-2.5 py-1 text-sm text-accent hover:border-accent"
      >
        + Add to list
      </button>
    );
  }

  return (
    <div className="w-full space-y-1.5">
      {error && <p className="text-xs text-danger">{error}</p>}
      <SearchPicker
        autoFocus
        disabled={busy}
        options={options}
        onPick={(o) => run(() => addPersonToListSafe(o.id, personId))}
        onCreate={(name) => run(() => createGroupWithPersonSafe(name, personId))}
        createLabel={(q) => `+ New group “${q}”`}
        placeholder="Find a list or name a new group…"
        emptyMessage={lists.length ? "Already on every list" : "No lists yet — type a name to start a group"}
      />
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-text-muted hover:text-text">
        Cancel
      </button>
    </div>
  );
}
