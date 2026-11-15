/** Custom field types and value checks (safe to import in the browser). See lib/custom-fields.ts. */
export type FieldKind = "text" | "number" | "date" | "yesno" | "choice";
export type CustomField = { id: string; label: string; kind: FieldKind; options: string[]; archived: boolean };

export const FIELD_KINDS: { value: FieldKind; label: string; hint: string }[] = [
  { value: "text", label: "Text", hint: "A word or short note, like a pet's name" },
  { value: "number", label: "Number", hint: "Like a member number or shoe size" },
  { value: "date", label: "Date", hint: "Like a renewal or anniversary date" },
  { value: "yesno", label: "Yes / no", hint: "Like “Newsletter” or “VIP”" },
  { value: "choice", label: "Pick from a list", hint: "Like Bronze, Silver, Gold" },
];

export const MAX_FIELDS = 20;
export const MAX_OPTIONS = 20;
export const MAX_TEXT = 200;

export function isFieldKind(v: unknown): v is FieldKind {
  return FIELD_KINDS.some((k) => k.value === v);
}

/** The stored form of a value, or null to clear it. Throws a readable message when it doesn't fit the field. */
export function cleanFieldValue(field: Pick<CustomField, "kind" | "options" | "label">, raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  switch (field.kind) {
    case "text":
      return v.replace(/\s+/g, " ").slice(0, MAX_TEXT);
    case "number": {
      const n = Number(v.replace(/,/g, ""));
      if (!Number.isFinite(n) || Math.abs(n) > 1e12) throw new Error(`${field.label} needs a number.`);
      return String(n);
    }
    case "date":
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(`${v}T12:00:00Z`))) throw new Error(`${field.label} needs a date.`);
      return v;
    case "yesno":
      if (v !== "yes" && v !== "no") throw new Error(`Choose yes or no for ${field.label}.`);
      return v;
    case "choice":
      if (!field.options.includes(v)) throw new Error(`Choose one of the options for ${field.label}.`);
      return v;
  }
}

/** How a stored value reads on screen and in exports. */
export function displayFieldValue(kind: FieldKind, value: string | null | undefined): string {
  if (!value) return "";
  if (kind === "yesno") return value === "yes" ? "Yes" : "No";
  if (kind === "date") {
    const d = new Date(`${value}T12:00:00Z`);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  }
  return value;
}
