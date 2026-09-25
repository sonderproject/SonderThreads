"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { parseCsv, rowsToPeople, type ImportRow } from "@/lib/csv";
import { importPeopleToListSafe } from "@/lib/actions/import";
import { Dictate } from "@/components/voice/Dictate";

export function ImportPeopleButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)} className="shrink-0">
        Import
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Import people from a file">
        <ImportForm onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}

function ImportForm({ onDone }: { onDone: () => void }) {
  const [people, setPeople] = useState<ImportRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [listName, setListName] = useState("");
  const [isGroup, setIsGroup] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const parsed = rowsToPeople(parseCsv(await file.text()));
    setPeople(parsed.people);
    setColumns(parsed.columns);
    if (!listName) setListName(file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim());
    if (parsed.people.length === 0) setError("Couldn't find any names in that file.");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (people.length === 0 || !listName.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await importPeopleToListSafe({ listName, isGroup, rows: people });
      if (result.ok) {
        onDone();
        router.push(`/lists/${result.data.listId}`);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div>
        <input
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/plain"
          onChange={onFile}
          className="block w-full text-sm text-text-muted file:mr-3 file:rounded file:border file:border-border file:bg-bg file:px-2 file:py-1 file:text-text"
        />
        <p className="mt-1 text-xs text-text-faint">
          CSV with a name (or first/last name) column — email, phone and birthday are picked up if present.
          A plain list of names, one per line, works too.
        </p>
      </div>
      {people.length > 0 && (
        <p className="font-mono text-xs text-accent">
          {people.length} {people.length === 1 ? "person" : "people"} found · columns: {columns.join(", ")}
        </p>
      )}
      <Dictate value={listName} onChange={setListName}>
        <input
          value={listName}
          onChange={(e) => setListName(e.target.value)}
          className="input"
          placeholder="List name"
        />
      </Dictate>
      <label className="flex items-center gap-2 text-sm text-text-muted">
        <input type="checkbox" checked={isGroup} onChange={(e) => setIsGroup(e.target.checked)} />
        This is a group (roster of people)
      </label>
      <Button type="submit" disabled={pending || people.length === 0 || !listName.trim()} className="w-full">
        {pending ? "Importing..." : `Import ${people.length || ""}`.trim()}
      </Button>
    </form>
  );
}
