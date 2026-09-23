"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListCard } from "@/components/lists/ListCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { createList } from "@/lib/actions/lists";
import type { List } from "@/lib/types";

export function ListsBrowser({
  lists,
  itemCounts,
}: {
  lists: List[];
  itemCounts: Record<string, number>;
}) {
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return lists;
    return lists.filter((l) =>
      [l.name, l.description].filter(Boolean).some((f) => f!.toLowerCase().includes(q)),
    );
  }, [lists, query]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search lists..."
          className="input font-mono"
        />
        <Button onClick={() => setModalOpen(true)} className="shrink-0">
          + New
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message={lists.length === 0 ? "No lists yet." : "No matches."} />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {filtered.map((list) => (
            <ListCard key={list.id} list={list} itemCount={itemCounts[list.id] ?? 0} />
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New list">
        <NewListForm onDone={() => setModalOpen(false)} />
      </Modal>
    </div>
  );
}

function NewListForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [isCohort, setIsCohort] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    startTransition(async () => {
      const list = await createList({ name, isCohort });
      setSaving(false);
      onDone();
      router.push(`/lists/${list.id}`);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="input"
        placeholder="Cohort 8"
      />
      <label className="flex items-center gap-2 text-sm text-text-muted">
        <input type="checkbox" checked={isCohort} onChange={(e) => setIsCohort(e.target.checked)} />
        This is a cohort (roster of clients)
      </label>
      <Button type="submit" disabled={saving || pending || !name.trim()} className="w-full">
        {saving || pending ? "Creating..." : "Create list"}
      </Button>
    </form>
  );
}
