"use server";

import { importAllowance, TRIAL_IMPORT_MESSAGE } from "@/lib/billing";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireUserId } from "@/lib/current-user";
import { assertCanWrite } from "@/lib/billing";
import { query, transaction } from "@/lib/db/client";
import { actorQuery, mineOrOrg } from "@/lib/db/scope";
import { logEvent } from "@/lib/events";
import { toActionResult, type ActionResult } from "@/lib/validation";
import {
  IMPORT_FIELDS,
  MAX_IMPORT_ROWS,
  buildRecords,
  identityKeys,
  mappingProblem,
  parseCsv,
  type ImportRecord,
} from "@/lib/client-import";

/** Server actions on Vercel accept bodies up to ~4.5 MB; stay under it. */
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_COLUMNS = 50;

export type ImportFile = { headers: string[]; rows: string[][] };
export type ImportOutcome = { imported: number; duplicates: number; skipped: number; blanked: number; batch: string | null };

/** One spreadsheet cell as text. Dates become YYYY-MM-DD so nothing depends on the server's time zone. */
function cellText(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "" : v.toISOString().slice(0, 10);
  if (typeof v === "number") return String(v);
  if (typeof v === "string" || typeof v === "boolean") return String(v);
  if (typeof v === "object") {
    const o = v as { richText?: { text: string }[]; text?: unknown; result?: unknown; error?: unknown };
    if (o.richText) return o.richText.map((r) => r.text).join("");
    if (o.error) return "";
    if (o.result !== undefined) return cellText(o.result);
    if (o.text !== undefined) return cellText(o.text);
  }
  return "";
}

async function readXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as Parameters<typeof wb.xlsx.load>[0]);
  const sheet = wb.worksheets.find((ws) => ws.actualRowCount > 0);
  if (!sheet) return [];
  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    for (let c = 1; c <= Math.min(row.cellCount, MAX_COLUMNS); c++) cells[c - 1] = cellText(row.getCell(c).value).trim();
    if (cells.some(Boolean)) rows.push(cells);
  });
  return rows;
}

/** Step 1: reads an uploaded CSV or Excel file into a header row and data rows. Nothing is saved. */
export async function readClientFile(form: FormData): Promise<ActionResult<ImportFile>> {
  return toActionResult(async () => {
    await requireUserId();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("Choose a file first.");
    if (file.size > MAX_BYTES) throw new Error("That file is over 4 MB. Split it into smaller files.");
    const name = file.name.toLowerCase();
    let table: string[][];
    if (name.endsWith(".xlsx")) {
      try {
        table = await readXlsx(await file.arrayBuffer());
      } catch {
        throw new Error("This Excel file couldn't be opened. Save it again as .xlsx or CSV and retry.");
      }
    } else if (name.endsWith(".csv") || name.endsWith(".txt") || name.endsWith(".tsv")) {
      table = parseCsv(await file.text());
    } else if (name.endsWith(".xls") || name.endsWith(".numbers")) {
      throw new Error("Save the file as .xlsx or CSV first (File → Save As), then upload it.");
    } else {
      throw new Error("Upload a CSV or Excel (.xlsx) file.");
    }
    if (table.length < 2) throw new Error("The file needs a header row and at least one client.");
    const width = Math.min(Math.max(...table.map((r) => r.length)), MAX_COLUMNS);
    const pad = (r: string[]) => Array.from({ length: width }, (_, i) => (r[i] ?? "").slice(0, 500));
    const [headers, ...rows] = table.map(pad);
    if (rows.length > MAX_IMPORT_ROWS) throw new Error(`That's ${rows.length.toLocaleString()} rows. Import up to ${MAX_IMPORT_ROWS.toLocaleString()} at a time.`);
    return { headers: headers.map((h, i) => h || `Column ${i + 1}`), rows };
  });
}

const fieldKeys = IMPORT_FIELDS.map((f) => f.key) as [string, ...string[]];
const commitSchema = z.object({
  rows: z.array(z.array(z.string().max(500)).max(MAX_COLUMNS)).min(1).max(MAX_IMPORT_ROWS),
  mapping: z.array(z.enum(fieldKeys).nullable()).max(MAX_COLUMNS),
  dateOrder: z.enum(["mdy", "dmy"]),
});

/**
 * Step 2: creates the client profiles, all at once or not at all. Every value
 * is checked again here. Clients already in Surfdesk (same email, phone, or name
 * and date of birth) are skipped, as are repeats within the file.
 */
export async function importClients(input: unknown): Promise<ActionResult<ImportOutcome>> {
  return toActionResult(async () => {
    const userId = await requireUserId();
    await assertCanWrite();
    const parsed = commitSchema.safeParse(input);
    if (!parsed.success) throw new Error("The import data wasn't valid. Upload the file again.");
    const { rows, dateOrder } = parsed.data;
    const mapping = parsed.data.mapping as Parameters<typeof buildRecords>[1];
    const problem = mappingProblem(mapping);
    if (problem) throw new Error(problem);

    const results = buildRecords(rows, mapping, dateOrder);
    const existing = await query<{ display_name: string; birthday: string | null; phone: string | null; email: string | null }>(
      `select display_name, to_char(birthday, 'YYYY-MM-DD') as birthday, phone, email
         from people where ${mineOrOrg("$1")} and deleted_at is null`,
      [userId],
    );
    const seen = new Set(existing.flatMap((p) => identityKeys({ displayName: p.display_name, birthday: p.birthday, phone: p.phone, email: p.email })));

    const toAdd: ImportRecord[] = [];
    let duplicates = 0;
    let skipped = 0;
    let blanked = 0;
    for (const r of results) {
      if (!r.record) {
        skipped++;
        continue;
      }
      const keys = identityKeys(r.record);
      if (keys.some((k) => seen.has(k))) {
        duplicates++;
        continue;
      }
      keys.forEach((k) => seen.add(k));
      if (r.warnings.length) blanked++;
      toAdd.push(r.record);
    }
    if (!toAdd.length) return { imported: 0, duplicates, skipped, blanked: 0, batch: null };
    // Without a card on file (free trial), imports are capped so a trial can't be reset by re-importing.
    const allowance = await importAllowance(userId);
    if (allowance !== null && toAdd.length > allowance) throw new Error(TRIAL_IMPORT_MESSAGE);

    const batch = randomUUID();
    const col = <K extends keyof ImportRecord>(k: K) => toAdd.map((p) => p[k]);
    await transaction(async (q) => {
      // The activity log records who made the change.
      await q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: userId })]);
      await q(
        `insert into people (user_id, first_name, last_name, display_name, birthday, phone, email, client_since, import_batch)
         select $1, f, l, d, b, p, e, s, $9
           from unnest($2::text[], $3::text[], $4::text[], $5::date[], $6::text[], $7::text[], $8::date[]) as t(f, l, d, b, p, e, s)`,
        [userId, col("firstName"), col("lastName"), col("displayName"), col("birthday"), col("phone"), col("email"), col("clientSince"), batch],
      );
    });

    await logEvent("client_import", `Imported ${toAdd.length} clients (${duplicates} duplicates skipped, ${skipped} without a name)`, {
      meta: { userId, batch, imported: toAdd.length, duplicates, skipped, blanked },
    });
    revalidatePath("/", "layout");
    return { imported: toAdd.length, duplicates, skipped, blanked, batch };
  });
}

/** Removes the clients one import created (only the person who imported them can). */
export async function undoClientImport(batch: string): Promise<ActionResult<number>> {
  return toActionResult(async () => {
    const userId = await requireUserId();
    await assertCanWrite();
    if (!z.string().uuid().safeParse(batch).success) throw new Error("Unknown import.");
    const removed = await actorQuery<{ id: string }>(
      userId,
      `update people set deleted_at = now() where user_id = $1 and import_batch = $2 and deleted_at is null returning id`,
      [userId, batch],
    );
    await logEvent("client_import_undone", `Undid an import of ${removed.length} clients`, { meta: { userId, batch } });
    revalidatePath("/", "layout");
    return removed.length;
  });
}
