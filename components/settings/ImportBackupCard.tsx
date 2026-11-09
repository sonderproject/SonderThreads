"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { previewBackup, restoreBackup, type RestoreCounts } from "@/lib/actions/restore";

/** Server actions on Vercel accept bodies up to ~4.5 MB; stay under it. */
const MAX_BYTES = 4 * 1024 * 1024;

const LABELS: [keyof RestoreCounts, string][] = [
  ["people", "people"],
  ["notes", "notes"],
  ["tasks", "tasks"],
  ["check_ins", "check-ins"],
  ["lists", "lists"],
  ["list_items", "list entries"],
  ["activity", "activity records"],
];

function summary(c: RestoreCounts): string {
  const parts = LABELS.filter(([k]) => c[k] > 0).map(([k, label]) => `${c[k]} ${label}`);
  return parts.length ? parts.join(", ") : "nothing new";
}

/** Settings → Data: restore a full backup file (the JSON download) into this account. */
export function ImportBackupCard() {
  const input = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<unknown>(null);
  const [preview, setPreview] = useState<RestoreCounts | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function reset() {
    setData(null);
    setPreview(null);
    setFileName("");
    if (input.current) input.current.value = "";
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setError(null);
    setDone(null);
    setPreview(null);
    if (!file) return;
    if (file.size > MAX_BYTES) return setError("That file is too large to import here (over 4 MB). Email support for help.");
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      return setError("This isn't a backup file. Choose the .json file from “download everything as one backup file”.");
    }
    setFileName(file.name);
    startTransition(async () => {
      const result = await previewBackup(parsed);
      if (!result.ok) return setError(result.error);
      setData(parsed);
      setPreview(result.data);
    });
  }

  function restore() {
    setError(null);
    startTransition(async () => {
      const result = await restoreBackup(data);
      if (!result.ok) return setError(`Nothing was imported. ${result.error}`);
      setDone(`Imported ${summary(result.data)}. Anything already in your account was skipped.`);
      reset();
      router.refresh();
    });
  }

  return (
    <div className="card space-y-3 p-4">
      <div>
        <h3 className="text-sm font-semibold text-text">Import backup</h3>
        <p className="text-xs text-text-muted">
          Restore a full backup file (.json) into this account: people, notes, tasks, check-ins, lists and history,
          all still linked together. Nothing already here is changed or duplicated.
        </p>
      </div>

      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        onChange={onFile}
        disabled={pending}
        className="block w-full text-sm text-text-muted file:mr-3 file:rounded file:border file:border-border file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-text hover:file:bg-bg-hover"
      />

      {pending && !preview && <p className="text-xs text-text-muted">Checking the file…</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
      {done && <p className="text-xs text-accent">{done}</p>}

      {preview && (
        <div className="space-y-3 rounded border border-border p-3">
          <p className="text-sm text-text">
            <span className="font-semibold">{fileName}</span> contains {summary(preview)}.
          </p>
          <p className="text-xs text-text-muted">It all goes in together, or nothing does if something fails.</p>
          <div className="flex gap-2">
            <Button onClick={restore} disabled={pending}>
              {pending ? "Importing…" : "Import"}
            </Button>
            <Button variant="ghost" onClick={reset} disabled={pending}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
