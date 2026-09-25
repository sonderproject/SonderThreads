"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListCard } from "@/components/lists/ListCard";
import { ImportPeopleButton } from "@/components/lists/ImportPeopleButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { createListSafe } from "@/lib/actions/lists";
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
        <ImportPeopleButton />
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
  const [isGroup, setIsGroup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    startTransition(async () => {
      const result = await createListSafe({ name, isGroup });
      setSaving(false);
      if (result.ok) {
        onDone();
        router.push(`/lists/${result.data.id}`);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && <p className="text-xs text-red-400">{error}</p>}
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="input"
        placeholder="Group 8"
      />
      <label className="flex items-center gap-2 text-sm text-text-muted">
        <input type="checkbox" checked={isGroup} onChange={(e) => setIsGroup(e.target.checked)} />
        This is a group (roster of people)
      </label>
      <Button type="submit" disabled={saving || pending || !name.trim()} className="w-full">
        {saving || pending ? "Creating..." : "Create list"}
      </Button>
    </form>
  );
}
