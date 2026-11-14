"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { importClients, readClientFile, undoClientImport, type ImportFile, type ImportOutcome } from "@/lib/actions/client-import";
import {
  IMPORT_FIELDS,
  TEMPLATE_CSV,
  buildRecords,
  dateValues,
  detectDateOrder,
  guessMapping,
  hasAmbiguousDates,
  mappingProblem,
  type DateOrder,
  type FieldKey,
  type Mapping,
} from "@/lib/client-import";

const MAX_BYTES = 4 * 1024 * 1024;
const PREVIEW_ROWS = 10;

function fmtDate(d: string | null): string {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${m}/${day}/${y}`;
}
function fmtPhone(p: string | null): string {
  if (!p) return "";
  return /^\d{10}$/.test(p) ? `(${p.slice(0, 3)}) ${p.slice(3, 6)}-${p.slice(6)}` : p;
}

/** Settings → Data: bring in a client list from a spreadsheet (CSV or Excel). */
export function ImportClientsCard() {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<ImportFile | null>(null);
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<Mapping>([]);
  const [order, setOrder] = useState<DateOrder>("mdy");
  const [askOrder, setAskOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ImportOutcome | null>(null);
  const [undone, setUndone] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function reset() {
    setFile(null);
    setFileName("");
    setMapping([]);
    if (input.current) input.current.value = "";
  }

  function setupDates(f: ImportFile, m: Mapping) {
    const values = dateValues(f.rows, m);
    const detected = detectDateOrder(values);
    setOrder(detected ?? "mdy");
    setAskOrder(!detected && hasAmbiguousDates(values));
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setError(null);
    setDone(null);
    setUndone(null);
    setFile(null);
    if (!f) return;
    if (f.size > MAX_BYTES) return setError("That file is over 4 MB. Split it into smaller files.");
    const form = new FormData();
    form.append("file", f);
    startTransition(async () => {
      const r = await readClientFile(form);
      if (!r.ok) return setError(r.error);
      const m = guessMapping(r.data.headers);
      setFile(r.data);
      setFileName(f.name);
      setMapping(m);
      setupDates(r.data, m);
    });
  }

  function changeMapping(i: number, value: string) {
    const next = [...mapping];
    const key = (value || null) as FieldKey | null;
    // A field can fill only one column: picking it here clears it elsewhere.
    if (key) next.forEach((k, j) => k === key && (next[j] = null));
    next[i] = key;
    setMapping(next);
    if (file) setupDates(file, next);
  }

  const problem = file ? mappingProblem(mapping) : null;
  const results = useMemo(() => (file && !problem ? buildRecords(file.rows, mapping, order) : []), [file, mapping, order, problem]);
  const ready = results.filter((r) => r.record).length;
  const noName = results.filter((r) => r.error).length;
  const flagged = results.filter((r) => r.record && r.warnings.length);
  const shown = new Set(mapping.filter(Boolean));

  function runImport() {
    if (!file) return;
    setError(null);
    startTransition(async () => {
      const r = await importClients({ rows: file.rows, mapping, dateOrder: order });
      if (!r.ok) return setError(`Nothing was imported. ${r.error}`);
      setDone(r.data);
      reset();
      router.refresh();
    });
  }

  function undo() {
    if (!done?.batch) return;
    startTransition(async () => {
      const r = await undoClientImport(done.batch!);
      if (!r.ok) return setError(r.error);
      setUndone(r.data);
      setDone(null);
      router.refresh();
    });
  }

  const templateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE_CSV)}`;

  return (
    <div id="import" className="card scroll-mt-20 space-y-3 p-4">
      <div>
        <h3 className="text-sm font-semibold text-text">Import your client list</h3>
        <p className="text-xs text-text-muted">
          Already have clients in a spreadsheet or another system? Export them as CSV or Excel and upload here. Names, dates of birth, phone numbers and emails go straight into client profiles. You&apos;ll match the columns and check a preview before anything
          is saved. Clients already in Surfdesk are skipped.{" "}
          <a href={templateHref} download="surfdesk-client-template.csv" className="text-accent hover:underline">
            Download a template
          </a>
        </p>
      </div>

      <input
        ref={input}
        type="file"
        accept=".csv,.xlsx,.txt,.tsv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={onFile}
        disabled={pending}
        className="block w-full text-sm text-text-muted file:mr-3 file:rounded file:border file:border-border file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-text hover:file:bg-bg-hover"
      />

      {pending && !file && !done && <p className="text-xs text-text-muted">Working…</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
      {undone !== null && <p className="text-xs text-text-muted">Import undone: {undone} clients removed.</p>}

      {done && (
        <div className="space-y-2 rounded border border-border p-3">
          <p className="text-sm text-accent">
            {done.imported ? `Imported ${done.imported.toLocaleString()} clients.` : "No new clients to import."}
          </p>
          <ul className="space-y-0.5 text-xs text-text-muted">
            {done.duplicates > 0 && <li>{done.duplicates} already in Surfdesk, skipped.</li>}
            {done.skipped > 0 && <li>{done.skipped} rows without a name, skipped.</li>}
            {done.blanked > 0 && <li>{done.blanked} imported with a value left blank because it couldn&apos;t be read.</li>}
          </ul>
          {done.batch && (
            <Button variant="ghost" onClick={undo} disabled={pending}>
              {pending ? "Undoing…" : "Undo this import"}
            </Button>
          )}
        </div>
      )}

      {file && (
        <div className="space-y-4 rounded border border-border p-3">
          <div className="space-y-2">
            <p className="text-sm text-text">
              <span className="font-semibold">{fileName}</span>: {file.rows.length.toLocaleString()} rows. Match each column:
            </p>
            <div className="divide-y divide-border">
              {file.headers.map((h, i) => (
                <label key={i} className="flex items-center gap-3 py-1.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-text">{h}</span>
                    <span className="block truncate text-xs text-text-faint">{file.rows.find((r) => r[i])?.[i] ?? "empty"}</span>
                  </span>
                  <select value={mapping[i] ?? ""} onChange={(e) => changeMapping(i, e.target.value)} className="input w-40 text-sm" aria-label={`Field for ${h}`}>
                    <option value="">Don&apos;t import</option>
                    {IMPORT_FIELDS.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>

          {askOrder && (
            <label className="block space-y-1">
              <span className="text-xs text-text-muted">Dates like 03/04/1990 in this file mean:</span>
              <select value={order} onChange={(e) => setOrder(e.target.value as DateOrder)} className="input w-auto text-sm">
                <option value="mdy">Month/Day/Year (March 4)</option>
                <option value="dmy">Day/Month/Year (3 April)</option>
              </select>
            </label>
          )}

          {problem ? (
            <p className="text-xs text-danger">{problem}</p>
          ) : (
            <>
              <div className="space-y-1">
                <p className="section-label">Preview</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-text-faint">
                      <tr>
                        <th className="py-1 pr-3 font-medium">Name</th>
                        {shown.has("birthday") && <th className="py-1 pr-3 font-medium">Date of birth</th>}
                        {shown.has("phone") && <th className="py-1 pr-3 font-medium">Phone</th>}
                        {shown.has("email") && <th className="py-1 pr-3 font-medium">Email</th>}
                        {shown.has("client_since") && <th className="py-1 pr-3 font-medium">Client since</th>}
                      </tr>
                    </thead>
                    <tbody className="text-text">
                      {results.slice(0, PREVIEW_ROWS).map((r) =>
                        r.record ? (
                          <tr key={r.line} className="border-t border-border">
                            <td className="py-1 pr-3">{r.record.displayName}</td>
                            {shown.has("birthday") && <td className="py-1 pr-3 tabular-nums">{fmtDate(r.record.birthday)}</td>}
                            {shown.has("phone") && <td className="py-1 pr-3 tabular-nums">{fmtPhone(r.record.phone)}</td>}
                            {shown.has("email") && <td className="py-1 pr-3">{r.record.email}</td>}
                            {shown.has("client_since") && <td className="py-1 pr-3 tabular-nums">{fmtDate(r.record.clientSince)}</td>}
                          </tr>
                        ) : (
                          <tr key={r.line} className="border-t border-border text-text-faint">
                            <td className="py-1 pr-3" colSpan={5}>
                              Row {r.line}: {r.error}, skipped
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
                {results.length > PREVIEW_ROWS && <p className="text-xs text-text-faint">Showing the first {PREVIEW_ROWS} rows.</p>}
              </div>

              {flagged.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-urgent">
                    {flagged.length} {flagged.length === 1 ? "row has a value" : "rows have values"} we couldn&apos;t read. They&apos;ll be
                    left blank, not guessed.
                  </summary>
                  <ul className="mt-1 max-h-48 space-y-0.5 overflow-y-auto text-text-muted">
                    {flagged.map((r) => (
                      <li key={r.line}>
                        Row {r.line} ({r.record!.displayName}): {r.warnings.join("; ")}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <p className="text-xs text-text-muted">
                {ready.toLocaleString()} ready to import{noName ? `, ${noName} without a name will be skipped` : ""}. It all goes in
                together, or nothing does if something fails.
              </p>
              <div className="flex gap-2">
                <Button onClick={runImport} disabled={pending || ready === 0}>
                  {pending ? "Importing…" : `Import ${ready.toLocaleString()} clients`}
                </Button>
                <Button variant="ghost" onClick={reset} disabled={pending}>
                  Cancel
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
