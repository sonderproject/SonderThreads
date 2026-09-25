/** One person parsed out of an imported file. */
export type ImportRow = {
  name: string;
  email: string | null;
  phone: string | null;
  birthday: string | null;
};

/** Minimal RFC 4180 CSV parser: quoted fields, escaped quotes, commas/newlines inside quotes, CRLF. Also accepts tab-separated input. */
export function parseCsv(text: string): string[][] {
  const input = text.replace(/^﻿/, "");
  const firstLine = input.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = firstLine.includes("\t") && !firstLine.includes(",") ? "\t" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"' && field === "") {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows
    .map((r) => r.map((f) => f.trim()))
    .filter((r) => r.some((f) => f !== ""));
}

const HEADER_ALIASES: Record<keyof ImportRow | "first" | "last", RegExp> = {
  name: /^(full\s*_?name|name|display\s*_?name|person|contact|participant|member|student)$/i,
  first: /^(first\s*_?name|first|given\s*_?name)$/i,
  last: /^(last\s*_?name|last|surname|family\s*_?name)$/i,
  email: /^(e-?mail(\s*address)?)$/i,
  phone: /^(phone(\s*number)?|mobile|cell|tel(ephone)?)$/i,
  birthday: /^(birthday|birth\s*_?date|date\s*of\s*birth|dob)$/i,
};

/** Accepts YYYY-MM-DD, M/D/YYYY or M/D/YY; anything else is dropped rather than guessed at. */
export function normalizeBirthday(value: string): string | null {
  const v = value.trim();
  const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const us = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  let y: number, m: number, d: number;
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (us) {
    [m, d, y] = [Number(us[1]), Number(us[2]), Number(us[3])];
    if (y < 100) y += y > new Date().getFullYear() % 100 ? 1900 : 2000;
  } else return null;

  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Turns parsed CSV rows into people. If the first row looks like a header
 * (has a name / first-name column), columns are mapped by header; otherwise
 * the first column is treated as the name — which also covers a plain .txt
 * file with one name per line.
 */
export function rowsToPeople(rows: string[][]): { people: ImportRow[]; columns: string[] } {
  if (rows.length === 0) return { people: [], columns: [] };

  const header = rows[0];
  const find = (key: keyof typeof HEADER_ALIASES) => header.findIndex((h) => HEADER_ALIASES[key].test(h));
  const idx = {
    name: find("name"),
    first: find("first"),
    last: find("last"),
    email: find("email"),
    phone: find("phone"),
    birthday: find("birthday"),
  };
  const hasHeader = idx.name >= 0 || idx.first >= 0;
  const body = hasHeader ? rows.slice(1) : rows;
  const cell = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");

  const people: ImportRow[] = [];
  const seen = new Set<string>();
  for (const r of body) {
    const name = hasHeader
      ? cell(r, idx.name) || [cell(r, idx.first), cell(r, idx.last)].filter(Boolean).join(" ")
      : cell(r, 0);
    const clean = name.replace(/\s+/g, " ").trim();
    if (!clean || seen.has(clean.toLowerCase())) continue;
    seen.add(clean.toLowerCase());

    const email = cell(r, idx.email);
    const birthday = cell(r, idx.birthday);
    people.push({
      name: clean,
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
      phone: cell(r, idx.phone) || null,
      birthday: birthday ? normalizeBirthday(birthday) : null,
    });
  }

  const columns = hasHeader
    ? (Object.keys(idx) as (keyof typeof idx)[]).filter((k) => idx[k] >= 0)
    : ["name"];
  return { people, columns };
}
