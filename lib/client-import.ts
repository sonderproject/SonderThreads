/**
 * Client list import: turns a spreadsheet's rows into clean client profiles.
 * Pure functions with no database access, shared by the Settings card (for the
 * preview) and the server action (which re-checks everything before saving).
 *
 * The rule: a value is saved only if we're sure it's right. Anything we can't
 * read with confidence (a phone with 7 digits, a date like 13/45/1990) is left
 * blank and flagged, never guessed.
 */

export const MAX_IMPORT_ROWS = 2000;

export type FieldKey = "full_name" | "first_name" | "last_name" | "birthday" | "phone" | "email" | "client_since";

export const IMPORT_FIELDS: { key: FieldKey; label: string }[] = [
  { key: "first_name", label: "First name" },
  { key: "last_name", label: "Last name" },
  { key: "full_name", label: "Full name" },
  { key: "birthday", label: "Date of birth" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "client_since", label: "Client since" },
];

/** Mapping: for each column in the file, the field it fills (or null to ignore it). */
export type Mapping = (FieldKey | null)[];
export type DateOrder = "mdy" | "dmy";

export type ImportRecord = {
  firstName: string;
  lastName: string | null;
  displayName: string;
  birthday: string | null;
  phone: string | null;
  email: string | null;
  clientSince: string | null;
};

export type RowResult = {
  /** 1-based row number in the file, counting the header row. */
  line: number;
  record: ImportRecord | null;
  /** Why the row can't be imported (no name). */
  error: string | null;
  /** Values that were left blank because they couldn't be read. */
  warnings: string[];
};

// ---------------------------------------------------------------- CSV

/** Parses CSV text (commas, semicolons or tabs; quoted fields; Excel's BOM). Drops empty rows. */
export function parseCsv(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const firstLine = text.slice(0, text.search(/\r?\n|$/));
  const delim = [",", ";", "\t"].reduce((best, d) => (count(firstLine, d) > count(firstLine, best) ? d : best), ",");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === delim) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  row.push(field);
  rows.push(row);
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ""));
}

function count(s: string, ch: string): number {
  return s.split(ch).length - 1;
}

// ---------------------------------------------------------------- Column guessing

const SYNONYMS: [FieldKey, RegExp][] = [
  ["first_name", /^(first|firstname|fname|givenname|given|forename|clientfirstname|first name)$/],
  ["last_name", /^(last|lastname|lname|surname|familyname|clientlastname)$/],
  ["full_name", /^(name|fullname|clientname|client|participant|participantname|customer|customername|contact|contactname|displayname)$/],
  ["birthday", /^(dob|dateofbirth|birthdate|birthday|birth|bday|clientdob)$/],
  ["phone", /^(phone|phonenumber|phoneno|mobile|mobilephone|cell|cellphone|cellnumber|telephone|tel|primaryphone|homephone|contactnumber|number)$/],
  ["email", /^(email|emailaddress|e-mail|mail|emailid|primaryemail)$/],
  ["client_since", /^(clientsince|startdate|intakedate|enrollmentdate|enrolled|enrollment|entrydate|projectstartdate|admitdate|admissiondate|datejoined|joined|since)$/],
];

/** Best guess at which field each column holds, from its header. Each field is used once. */
export function guessMapping(headers: string[]): Mapping {
  const used = new Set<FieldKey>();
  return headers.map((h) => {
    const k = h.toLowerCase().replace(/[^a-z-]/g, "");
    const hit = SYNONYMS.find(([key, re]) => !used.has(key) && re.test(k));
    if (!hit) return null;
    used.add(hit[0]);
    return hit[0];
  });
}

/** The mapping problem to show, or null when it's usable. */
export function mappingProblem(mapping: Mapping): string | null {
  const seen = new Set<FieldKey>();
  for (const m of mapping) {
    if (!m) continue;
    if (seen.has(m)) return `Two columns are set to “${IMPORT_FIELDS.find((f) => f.key === m)!.label}”. Pick one.`;
    seen.add(m);
  }
  if (!seen.has("full_name") && !seen.has("first_name")) return "Choose the column with each client's name (a full name, or a first name).";
  return null;
}

// ---------------------------------------------------------------- Values

/** "MARIA DE LA CRUZ" → "Maria De La Cruz". Mixed-case names are left exactly as typed. */
export function tidyName(s: string): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (!/[a-z]/.test(t) === !/[A-Z]/.test(t)) return t; // has both cases (or neither): keep as typed
  return t.toLowerCase().replace(/(^|[\s\-'’])(\p{L})/gu, (_, sep: string, c: string) => sep + c.toUpperCase());
}

/** Splits a full name. "Garcia, Maria" is read as last, first. */
export function splitFullName(s: string): { first: string; last: string | null } {
  const t = tidyName(s);
  if (t.includes(",")) {
    const [last, ...rest] = t.split(",");
    const first = rest.join(",").trim();
    if (first && last.trim()) return { first, last: last.trim() };
  }
  const parts = t.split(" ").filter(Boolean);
  return { first: parts[0] ?? "", last: parts.length > 1 ? parts.slice(1).join(" ") : null };
}

/**
 * A phone number as stored in Surfdesk: 10 digits for US/Canada ("6195551234"),
 * "+<country><number>" otherwise. Extensions are dropped. null = can't be a real number.
 */
export function cleanPhone(s: string): string | null {
  const main = s.split(/\s*(?:ext\.?|x|#)\s*\d+\s*$/i)[0].trim();
  const digits = main.replace(/\D/g, "");
  if (!digits) return null;
  if (main.startsWith("+") && !main.startsWith("+1")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  const us = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  // US/Canada numbers: 10 digits, and neither the area code nor the exchange starts with 0 or 1.
  return us.length === 10 && /^[2-9]\d{2}[2-9]/.test(us) ? us : null;
}

const EMAIL_RE = /^[^\s@,;<>()]+@[^\s@,;<>()]+\.[a-z]{2,}$/i;

/** A lowercased email, or null when it isn't one. "mailto:" and "Name <a@b.co>" are unwrapped. */
export function cleanEmail(s: string): string | null {
  let t = s.trim().replace(/^mailto:/i, "");
  const angle = t.match(/<([^>]+)>/);
  if (angle) t = angle[1];
  t = t.trim().toLowerCase();
  return t.length <= 320 && EMAIL_RE.test(t) ? t : null;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function iso(y: number, m: number, d: number): string | null {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Two-digit years: in the future → last century ("85" → 1985, "05" → 2005 if that's not after today). */
function fullYear(y: string, today: string): number {
  if (y.length === 4) return Number(y);
  const n = Number(y);
  const thisYear = Number(today.slice(0, 4));
  return 2000 + n > thisYear ? 1900 + n : 2000 + n;
}

/**
 * Reads a date the way people type them: 1990-03-04, 3/4/1990, 03-04-90,
 * Mar 4 1990, 4 March 1990, or an Excel date number. Slash dates follow
 * `order` (US month-first by default). Returns YYYY-MM-DD, or null if it isn't
 * a real date between 1900 and today.
 */
export function parseDate(s: string, order: DateOrder = "mdy", today = new Date().toISOString().slice(0, 10)): string | null {
  const t = s.trim().replace(/\s+/g, " ");
  if (!t) return null;
  let out: string | null = null;
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T].*)?$/))) out = iso(+m[1], +m[2], +m[3]);
  else if ((m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?: .*)?$/))) {
    const y = fullYear(m[3], today);
    out = order === "mdy" ? iso(y, +m[1], +m[2]) : iso(y, +m[2], +m[1]);
  } else if ((m = t.match(/^([a-z]{3,})\.? (\d{1,2})(?:st|nd|rd|th)?,? (\d{4})$/i))) {
    const mo = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1;
    out = mo ? iso(+m[3], mo, +m[2]) : null;
  } else if ((m = t.match(/^(\d{1,2})(?:st|nd|rd|th)? ([a-z]{3,})\.?,? (\d{4})$/i))) {
    const mo = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1;
    out = mo ? iso(+m[3], mo, +m[1]) : null;
  } else if ((m = t.match(/^(\d{5})(?:\.0+)?$/))) {
    // Excel's date number: days since 1899-12-30.
    const n = +m[1];
    if (n > 0 && n < 80000) out = new Date(Date.UTC(1899, 11, 30) + n * 86_400_000).toISOString().slice(0, 10);
  }
  if (!out || out < "1900-01-01" || out > today) return null;
  return out;
}

/**
 * Whether the file's slash dates are day-first. Only decided by a value that
 * can't be month-first (like 25/12/1990); otherwise null (ambiguous or none).
 */
export function detectDateOrder(values: string[]): DateOrder | null {
  let dayFirst = false;
  let monthFirst = false;
  for (const v of values) {
    const m = v.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})/);
    if (!m) continue;
    if (+m[1] > 12 && +m[2] <= 12) dayFirst = true;
    if (+m[2] > 12 && +m[1] <= 12) monthFirst = true;
  }
  if (dayFirst && !monthFirst) return "dmy";
  if (monthFirst && !dayFirst) return "mdy";
  return null;
}

/** True when the slash dates in these columns could be read either way (like 03/04/1990). */
export function hasAmbiguousDates(values: string[]): boolean {
  return values.some((v) => {
    const m = v.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})/);
    return !!m && +m[1] <= 12 && +m[2] <= 12 && m[1] !== m[2];
  });
}

/** All values in the file's date columns, for date-order detection. */
export function dateValues(rows: string[][], mapping: Mapping): string[] {
  const cols = mapping.flatMap((f, i) => (f === "birthday" || f === "client_since" ? [i] : []));
  return rows.flatMap((r) => cols.map((i) => r[i] ?? "")).filter(Boolean);
}

// ---------------------------------------------------------------- Rows

/** Turns data rows (no header) into records, with the problems found in each. */
export function buildRecords(rows: string[][], mapping: Mapping, order: DateOrder, today?: string): RowResult[] {
  const col = (key: FieldKey) => mapping.indexOf(key);
  const cell = (r: string[], key: FieldKey) => {
    const i = col(key);
    return i >= 0 ? (r[i] ?? "").trim() : "";
  };
  return rows.map((r, idx) => {
    const line = idx + 2;
    const warnings: string[] = [];
    let first = tidyName(cell(r, "first_name"));
    let last: string | null = tidyName(cell(r, "last_name")) || null;
    const full = cell(r, "full_name");
    if (!first && full) {
      const s = splitFullName(full);
      first = s.first;
      last = last ?? s.last;
    }
    if (!first && last) [first, last] = [last, null];
    if (!first) return { line, record: null, error: "No name", warnings };
    if (first.length > 100 || (last?.length ?? 0) > 100) return { line, record: null, error: "Name is too long", warnings };

    const read = (key: FieldKey, label: string, fn: (s: string) => string | null): string | null => {
      const raw = cell(r, key);
      if (!raw) return null;
      const v = fn(raw);
      if (!v) warnings.push(`${label} “${raw.slice(0, 40)}” couldn't be read, left blank`);
      return v;
    };
    const birthday = read("birthday", "Date of birth", (s) => parseDate(s, order, today));
    const clientSince = read("client_since", "Client since", (s) => parseDate(s, order, today));
    const phone = read("phone", "Phone", cleanPhone);
    const email = read("email", "Email", cleanEmail);
    const displayName = [first, last].filter(Boolean).join(" ");
    return { line, record: { firstName: first, lastName: last, displayName, birthday, phone, email, clientSince }, error: null, warnings };
  });
}

/**
 * Keys that identify the same client: email, phone, or full name + date of
 * birth. Two records sharing any key are treated as the same person.
 */
export function identityKeys(p: { displayName: string; birthday: string | null; phone: string | null; email: string | null }): string[] {
  const keys: string[] = [];
  if (p.email) keys.push(`e:${p.email.toLowerCase()}`);
  if (p.phone) keys.push(`p:${p.phone.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "")}`);
  if (p.birthday) keys.push(`nb:${p.displayName.toLowerCase().replace(/\s+/g, " ").trim()}|${p.birthday}`);
  return keys;
}

/** A downloadable starter file. */
export const TEMPLATE_CSV =
  "First name,Last name,Date of birth,Phone,Email,Client since\r\nMaria,Garcia,03/14/1985,(619) 555-0142,maria@example.com,01/10/2024\r\n";
