"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  addListItemSmartSafe,
  addNewPersonToListSafe,
  addPersonToListSafe,
  deleteList,
  duplicateList,
  removeListItem,
  restoreList,
  restoreListItem,
  renameList,
  reorderListItems,
  toggleListItem,
  updateListDescription,
  updateListItemNoteSafe,
  updateListItemSafe,
} from "@/lib/actions/lists";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useUndo } from "@/components/ui/UndoToast";
import type { List, ListItem, Person } from "@/lib/types";
import { SearchPicker } from "@/components/ui/SearchPicker";
import { Dictate } from "@/components/voice/Dictate";
import { ShareMenu } from "@/components/lists/ShareMenu";
import { addListItemsToPeopleSafe } from "@/lib/actions/import";
import { NAME_INPUT, PROSE_INPUT } from "@/lib/input-props";
import { NoteIcon } from "@/components/ui/icons";

export function ListDetail({
  list,
  items,
  people = [],
}: {
  list: List;
  items: ListItem[];
  /** Everyone, for the group-list person picker. */
  people?: Pick<Person, "id" | "display_name">[];
}) {
  const router = useRouter();
  const [localItems, setLocalItems] = useState(items);
  const [newLabel, setNewLabel] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(list.name);
  const [description, setDescription] = useState(list.description ?? "");
  const [editingDescription, setEditingDescription] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const dragStartOrder = useRef<ListItem[] | null>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const undo = useUndo();
  const [addError, setAddError] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [notingItemId, setNotingItemId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [itemError, setItemError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [toPeopleBusy, setToPeopleBusy] = useState(false);
  const [toPeopleMsg, setToPeopleMsg] = useState<string | null>(null);

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function handleAddToPeople() {
    setToPeopleBusy(true);
    setToPeopleMsg(null);
    const result = await addListItemsToPeopleSafe(list.id);
    setToPeopleBusy(false);
    if (!result.ok) {
      setToPeopleMsg(result.error);
      return;
    }
    const { created, linked, skipped, links } = result.data;
    setLocalItems((prev) => prev.map((i) => (links[i.id] ? { ...i, person_id: links[i.id] } : i)));
    const parts = [
      created && `${created} added to People`,
      linked && `${linked} matched existing people`,
      skipped && `${skipped} skipped (no name)`,
    ].filter(Boolean);
    setToPeopleMsg(parts.length ? `✓ ${parts.join(" · ")}` : "Everyone here is already in People.");
    router.refresh();
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

  // Group lists: pick people instead of typing free text.
  const onList = new Set(localItems.map((i) => i.person_id).filter(Boolean));
  const pickable = people.filter((p) => !onList.has(p.id)).map((p) => ({ id: p.id, label: p.display_name }));

  async function addPickedPerson(personId: string) {
    setAddError(null);
    const result = await addPersonToListSafe(list.id, personId);
    if (result.ok) {
      setLocalItems((prev) => [...prev, result.data]);
      refresh();
    } else setAddError(result.error);
  }

  async function addNewPerson(fullName: string) {
    setAddError(null);
    const result = await addNewPersonToListSafe(list.id, fullName);
    if (result.ok) {
      setLocalItems((prev) => [...prev, result.data]);
      refresh();
    } else setAddError(result.error);
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
    const removed = await removeListItem(item.id);
    refresh();
    if (removed) {
      undo.show(`Removed "${removed.label}"`, async () => {
        await restoreListItem(removed);
        setLocalItems((prev) => [...prev, removed].sort((a, b) => a.position - b.position));
        refresh();
      });
    }
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

  function startNote(item: ListItem) {
    setNotingItemId(item.id);
    setNoteText(item.note ?? "");
    setItemError(null);
  }

  async function saveNote(item: ListItem) {
    setNotingItemId(null);
    if (noteText.trim() === (item.note ?? "")) return;
    const optimistic = noteText.trim() || null;
    setLocalItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, note: optimistic } : i)));
    const result = await updateListItemNoteSafe(item.id, noteText);
    if (result.ok) {
      setLocalItems((prev) => prev.map((i) => (i.id === item.id ? result.data : i)));
      refresh();
    } else {
      setLocalItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
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
    await deleteList(list.id);
    router.push("/lists");
    undo.show(`Deleted "${list.name}"`, async () => {
      await restoreList(list.id);
      router.push(`/lists/${list.id}`);
    });
  }

  // Pointer-based reordering (works with mouse, finger and pen — HTML5
  // drag-and-drop doesn't fire on touch screens). The grip captures the
  // pointer; moving it past another row's midpoint swaps them live.
  function onGripDown(e: React.PointerEvent, item: ListItem) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartOrder.current = localItems;
    setDragId(item.id);
  }

  function onGripMove(e: React.PointerEvent) {
    if (!dragId) return;
    const y = e.clientY;
    setLocalItems((items) => {
      const from = items.findIndex((i) => i.id === dragId);
      let to = 0;
      items.forEach((i) => {
        if (i.id === dragId) return;
        const rect = rowRefs.current.get(i.id)?.getBoundingClientRect();
        if (rect && y > rect.top + rect.height / 2) to++;
      });
      if (from === to || from < 0) return items;
      const next = [...items];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function onGripUp() {
    const before = dragStartOrder.current;
    setDragId(null);
    dragStartOrder.current = null;
    if (!before || before.map((i) => i.id).join() === localItems.map((i) => i.id).join()) return;
    const after = localItems;
    startTransition(async () => {
      await reorderListItems(list.id, after.map((i) => i.id));
    });
    undo.show("Moved item", async () => {
      setLocalItems(before);
      await reorderListItems(list.id, before.map((i) => i.id));
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          {renaming ? (
            <Dictate value={name} onChange={setName}>
              <input
                {...PROSE_INPUT}
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => e.key === "Enter" && handleRename()}
                className="input text-lg"
              />
            </Dictate>
          ) : (
            <h1
              onClick={() => setRenaming(true)}
              className="page-title cursor-text"
              title="Click to rename"
            >
              {list.name}
            </h1>
          )}
          {list.is_group && <Badge>group</Badge>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <ShareMenu list={{ ...list, name, description: description || null }} items={localItems} />
          <Button
            variant="ghost"
            onClick={handleAddToPeople}
            disabled={toPeopleBusy || localItems.length === 0}
            title="Make each item a person in People (name, birthday and phone are split out)"
          >
            {toPeopleBusy ? "Adding…" : "Add to People"}
          </Button>
          <details className="relative">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded border border-border px-3 py-1.5 text-sm font-medium text-text transition-colors hover:bg-bg-hover [&::-webkit-details-marker]:hidden">
              Export ▾
            </summary>
            <div className="absolute left-0 z-20 mt-1 w-36 overflow-hidden sm:left-auto sm:right-0 rounded border border-border bg-bg-raised shadow-lg">
              {[
                ["pdf", "PDF"],
                ["xlsx", "Excel (.xlsx)"],
              ].map(([format, label]) => (
                <a
                  key={format}
                  href={`/api/lists/${list.id}/export?format=${format}`}
                  download
                  onClick={(e) => e.currentTarget.closest("details")?.removeAttribute("open")}
                  className="block px-3 py-2 text-sm text-text hover:bg-bg-hover"
                >
                  {label}
                </a>
              ))}
            </div>
          </details>
          <Button variant="ghost" onClick={handleDuplicate}>
            Duplicate
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </div>
      {toPeopleMsg && <p className="tabular-nums text-xs text-text-muted">{toPeopleMsg}</p>}

      {editingDescription ? (
        <Dictate value={description} onChange={setDescription}>
          <input
            {...PROSE_INPUT}
            autoFocus
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleDescriptionSave}
            onKeyDown={(e) => e.key === "Enter" && handleDescriptionSave()}
            className="input"
            placeholder="Description..."
          />
        </Dictate>
      ) : (
        <p
          onClick={() => setEditingDescription(true)}
          className="cursor-text text-sm text-text-muted"
        >
          {list.description || "Add a description..."}
        </p>
      )}

      {list.is_group ? (
        <SearchPicker
          options={pickable}
          onPick={(o) => addPickedPerson(o.id)}
          onCreate={addNewPerson}
          createLabel={(q) => `+ Add “${q}” as a new person`}
          placeholder="Add a person… start typing a name"
          emptyMessage={people.length ? "Everyone's already on this list" : "No people yet"}
        />
      ) : (
      <form onSubmit={handleAddItem} className="flex gap-2">
        <Dictate value={newLabel} onChange={setNewLabel}>
          <input
            {...(list.is_group ? NAME_INPUT : PROSE_INPUT)}
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Add item..."
            className="input tabular-nums"
          />
        </Dictate>
        <Button type="submit" disabled={!newLabel.trim() || pending}>
          Add
        </Button>
      </form>
      )}
      {addError && <p className="text-xs text-red-400">{addError}</p>}

      {localItems.length === 0 ? (
        <EmptyState message="No items yet." />
      ) : (
        <div className="divide-y divide-border-subtle card">
          {localItems.map((item) => (
            <div
              key={item.id}
              ref={(el) => {
                if (el) rowRefs.current.set(item.id, el);
                else rowRefs.current.delete(item.id);
              }}
              className={`flex items-center gap-2 px-2 py-1.5 sm:gap-3 sm:py-1 ${
                dragId === item.id ? "relative z-10 bg-bg-hover shadow-lg shadow-black/30" : "hover:bg-bg-hover"
              }`}
            >
              <span
                onPointerDown={(e) => onGripDown(e, item)}
                onPointerMove={onGripMove}
                onPointerUp={onGripUp}
                onPointerCancel={onGripUp}
                role="button"
                aria-label="Drag to reorder"
                className="flex h-10 w-8 shrink-0 cursor-grab touch-none select-none items-center justify-center text-text-faint active:cursor-grabbing"
              >
                ⠿
              </span>
              <input
                type="checkbox"
                checked={item.checked}
                onChange={() => handleToggle(item)}
                className="h-5 w-5 accent-accent sm:h-4 sm:w-4"
              />
              <div className="min-w-0 flex-1 py-1">
                {editingItemId === item.id ? (
                  <Dictate value={editLabel} onChange={setEditLabel}>
                    <input
                      {...(list.is_group ? NAME_INPUT : PROSE_INPUT)}
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
                  </Dictate>
                ) : item.person_id ? (
                  <Link
                    href={`/people/${item.person_id}`}
                    className={`text-sm hover:underline ${item.checked ? "text-text-faint line-through" : "text-accent"}`}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className={`text-sm ${item.checked ? "text-text-faint line-through" : "text-text"}`}>
                    {item.label}
                  </span>
                )}
                {notingItemId === item.id ? (
                  <input
                    {...PROSE_INPUT}
                    autoFocus
                    value={noteText}
                    maxLength={500}
                    placeholder="Add a note…"
                    onChange={(e) => setNoteText(e.target.value)}
                    onBlur={() => saveNote(item)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveNote(item);
                      if (e.key === "Escape") setNotingItemId(null);
                    }}
                    className="input mt-1 py-1.5 text-sm sm:py-1"
                  />
                ) : (
                  item.note && (
                    <button
                      type="button"
                      onClick={() => startNote(item)}
                      className="block max-w-full text-left text-xs leading-snug text-text-muted hover:text-text"
                      title="Edit note"
                    >
                      {item.note}
                    </button>
                  )
                )}
              </div>
              {editingItemId !== item.id && notingItemId !== item.id && (
                <button
                  onClick={() => startNote(item)}
                  className={`flex h-9 w-9 items-center justify-center rounded hover:text-accent ${item.note ? "text-accent" : "text-text-faint"}`}
                  aria-label={item.note ? "Edit note" : "Add note"}
                  title={item.note ? "Edit note" : "Add note"}
                >
                  <NoteIcon />
                </button>
              )}
              {editingItemId !== item.id && (
                <button
                  onClick={() => startEditItem(item)}
                  className="flex h-9 w-9 items-center justify-center rounded text-text-faint hover:text-accent"
                  aria-label="Edit item"
                >
                  ✎
                </button>
              )}
              <button
                onClick={() => handleRemove(item)}
                className="flex h-9 w-9 items-center justify-center rounded text-text-faint hover:text-danger"
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
