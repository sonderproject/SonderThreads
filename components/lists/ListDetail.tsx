"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  addListItemSmartSafe,
  deleteList,
  duplicateList,
  removeListItem,
  renameList,
  reorderListItems,
  toggleListItem,
  updateListDescription,
  updateListItemSafe,
} from "@/lib/actions/lists";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { List, ListItem } from "@/lib/types";

export function ListDetail({ list, items }: { list: List; items: ListItem[] }) {
  const router = useRouter();
  const [localItems, setLocalItems] = useState(items);
  const [newLabel, setNewLabel] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(list.name);
  const [description, setDescription] = useState(list.description ?? "");
  const [editingDescription, setEditingDescription] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [itemError, setItemError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return;
    const label = newLabel.trim();
    setAddError(null);
    const result = await addListItemSmartSafe(list.id, label);
    if (result.ok) {
      setNewLabel("");
      setLocalItems((prev) => [...prev, result.data]);
      refresh();
    } else {
      setAddError(result.error);
    }
  }

  async function handleToggle(item: ListItem) {
    setLocalItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, checked: !i.checked } : i)),
    );
    await toggleListItem(item.id, !item.checked);
    refresh();
  }

  async function handleRemove(item: ListItem) {
    setLocalItems((prev) => prev.filter((i) => i.id !== item.id));
    await removeListItem(item.id);
    refresh();
  }

  function startEditItem(item: ListItem) {
    setEditingItemId(item.id);
    setEditLabel(item.label);
    setItemError(null);
  }

  async function saveItemLabel(item: ListItem) {
    const trimmed = editLabel.trim();
    if (!trimmed || trimmed === item.label) {
      setEditingItemId(null);
      return;
    }
    const result = await updateListItemSafe(item.id, trimmed);
    if (result.ok) {
      setLocalItems((prev) => prev.map((i) => (i.id === item.id ? result.data : i)));
      setEditingItemId(null);
      refresh();
    } else {
      setItemError(result.error);
    }
  }

  async function handleRename() {
    setRenaming(false);
    if (name.trim() && name.trim() !== list.name) {
      await renameList(list.id, name.trim());
      refresh();
    }
  }

  async function handleDescriptionSave() {
    setEditingDescription(false);
    if (description !== (list.description ?? "")) {
      await updateListDescription(list.id, description);
      refresh();
    }
  }

  async function handleDuplicate() {
    const copy = await duplicateList(list.id);
    router.push(`/lists/${copy.id}`);
  }

  async function handleDelete() {
    if (!confirm(`Delete "${list.name}"? This can't be undone.`)) return;
    await deleteList(list.id);
    router.push("/lists");
  }

  function onDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) return;
    const next = [...localItems];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    setLocalItems(next);
    setDragIndex(null);
    startTransition(async () => {
      await reorderListItems(list.id, next.map((i) => i.id));
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {renaming ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
              className="input font-mono text-lg uppercase"
            />
          ) : (
            <h1
              onClick={() => setRenaming(true)}
              className="cursor-text font-mono text-lg uppercase tracking-wide text-text"
              title="Click to rename"
            >
              {list.name}
            </h1>
          )}
          {list.is_group && <Badge>group</Badge>}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="ghost" onClick={handleDuplicate}>
            Duplicate
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </div>

      {editingDescription ? (
        <input
          autoFocus
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={handleDescriptionSave}
          onKeyDown={(e) => e.key === "Enter" && handleDescriptionSave()}
          className="input"
          placeholder="Description..."
        />
      ) : (
        <p
          onClick={() => setEditingDescription(true)}
          className="cursor-text text-sm text-text-muted"
        >
          {list.description || "Add a description..."}
        </p>
      )}

      <form onSubmit={handleAddItem} className="flex gap-2">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Add item..."
          className="input font-mono"
        />
        <Button type="submit" disabled={!newLabel.trim() || pending}>
          Add
        </Button>
      </form>
      {addError && <p className="text-xs text-red-400">{addError}</p>}

      {localItems.length === 0 ? (
        <EmptyState message="No items yet." />
      ) : (
        <div className="divide-y divide-border-subtle rounded border border-border">
          {localItems.map((item, index) => (
            <div
              key={item.id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(index)}
              className="flex items-center gap-3 px-3 py-2 hover:bg-bg-hover"
            >
              <span className="cursor-grab select-none text-text-faint">⠿</span>
              <input
                type="checkbox"
                checked={item.checked}
                onChange={() => handleToggle(item)}
                className="h-4 w-4 accent-accent"
              />
              {editingItemId === item.id ? (
                <input
                  autoFocus
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  onBlur={() => saveItemLabel(item)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveItemLabel(item);
                    if (e.key === "Escape") setEditingItemId(null);
                  }}
                  className="input flex-1 text-sm"
                />
              ) : item.person_id ? (
                <Link
                  href={`/people/${item.person_id}`}
                  className={`flex-1 text-sm hover:underline ${item.checked ? "text-text-faint line-through" : "text-accent"}`}
                >
                  {item.label}
                </Link>
              ) : (
                <span className={`flex-1 text-sm ${item.checked ? "text-text-faint line-through" : "text-text"}`}>
                  {item.label}
                </span>
              )}
              {editingItemId !== item.id && (
                <button
                  onClick={() => startEditItem(item)}
                  className="text-text-faint hover:text-accent"
                  aria-label="Edit item"
                >
                  ✎
                </button>
              )}
              <button
                onClick={() => handleRemove(item)}
                className="text-text-faint hover:text-danger"
                aria-label="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      {itemError && <p className="text-xs text-red-400">{itemError}</p>}
    </div>
  );
}
