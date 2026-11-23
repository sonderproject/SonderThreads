/**
 * Smart forms: field types, the form definition, validation of a submission and the
 * mapping of answers onto a profile. No database or server imports, so the builder
 * (browser), the public form (server) and the tests all use the exact same rules.
 */

export type FormFieldType =
  | "short_text"
  | "long_text"
  | "email"
  | "phone"
  | "number"
  | "date"
  | "time"
  | "dropdown"
  | "multiple_choice"
  | "checkboxes"
  | "yes_no"
  | "rating"
  | "consent"
  | "heading"
  | "info";

/**
 * Where an answer goes on the person's profile. "note" collects it into the intake note;
 * "custom:<id>" is one of the account's custom fields. Ownership, roles, status, billing
 * and security settings are deliberately not mappable.
 */
export type MapTarget = "first_name" | "last_name" | "full_name" | "email" | "phone" | "birthday" | `custom:${string}` | null;

export type FormField = {
  /** Short stable id, the key of the answer. */
  id: string;
  type: FormFieldType;
  label: string;
  description?: string;
  required?: boolean;
  placeholder?: string;
  /** Choices for dropdown, multiple choice and checkboxes. */
  options?: string[];
  /** number: min/max value; short/long text: max length. */
  min?: number;
  max?: number;
  maxLength?: number;
  mapTo?: MapTarget;
};

export type IntakeMode = "review" | "auto" | "none";

export type FormSettings = {
  /** review: staff approve each submission; auto: create the profile when there's no possible duplicate; none: just collect. */
  intake: IntakeMode;
  /** Who new profiles belong to and who is notified (a member of the organization), or null for the form's owner. */
  assignTo: string | null;
  /** Stop accepting after this moment (ISO), or null. */
  closesAt: string | null;
  /** Stop after this many submissions, or null. */
  maxSubmissions: number | null;
  /** Delete submissions this many days after they arrive, or null to keep them. */
  retentionDays: number | null;
  successMessage: string;
};

export type FormStatus = "draft" | "published" | "paused" | "archived";
export type SubmissionStatus = "new" | "needs_review" | "approved" | "processed" | "rejected";

export const SUBMISSION_STATUSES: { value: SubmissionStatus; label: string; tone: string }[] = [
  { value: "new", label: "New", tone: "tag-n" },
  { value: "needs_review", label: "Needs review", tone: "tag-e" },
  { value: "approved", label: "Approved", tone: "tag-v" },
  { value: "processed", label: "Processed", tone: "" },
  { value: "rejected", label: "Rejected", tone: "tag-u" },
];

export const FIELD_TYPES: { type: FormFieldType; label: string; input: boolean }[] = [
  { type: "short_text", label: "Short text", input: true },
  { type: "long_text", label: "Long text", input: true },
  { type: "email", label: "Email", input: true },
  { type: "phone", label: "Phone number", input: true },
  { type: "number", label: "Number", input: true },
  { type: "date", label: "Date", input: true },
  { type: "time", label: "Time", input: true },
  { type: "dropdown", label: "Dropdown", input: true },
  { type: "multiple_choice", label: "Multiple choice", input: true },
  { type: "checkboxes", label: "Checkboxes", input: true },
  { type: "yes_no", label: "Yes / no", input: true },
  { type: "rating", label: "Rating (1–5)", input: true },
  { type: "consent", label: "Consent checkbox", input: true },
  { type: "heading", label: "Section heading", input: false },
  { type: "info", label: "Information text", input: false },
];

/** Fair-use limits for forms (one place; see also the rate limits in lib/forms-intake.ts). */
export const FORM_LIMITS = {
  formsPerAccount: 50,
  fieldsPerForm: 60,
  optionsPerField: 30,
  labelLength: 200,
  descriptionLength: 1000,
  optionLength: 120,
  shortText: 300,
  longText: 5000,
  successMessage: 500,
  /** Submissions from one network in an hour, per form owner. */
  perNetworkPerHour: 10,
  /** Submissions to one form in a day. */
  perFormPerDay: 500,
  /** Seconds a person needs at least to fill in a form (faster is a bot). */
  minSeconds: 3,
} as const;

export const DEFAULT_SETTINGS: FormSettings = {
  intake: "review",
  assignTo: null,
  closesAt: null,
  maxSubmissions: null,
  retentionDays: null,
  successMessage: "Thanks! We received your answers.",
};

const OPTION_TYPES: FormFieldType[] = ["dropdown", "multiple_choice", "checkboxes"];
export const hasOptions = (t: FormFieldType) => OPTION_TYPES.includes(t);
export const isInputField = (t: FormFieldType) => FIELD_TYPES.find((f) => f.type === t)?.input ?? false;

/** Which profile fields an answer of this type may fill (custom fields are checked against their own kind). */
export function mapTargetsFor(type: FormFieldType): ("first_name" | "last_name" | "full_name" | "email" | "phone" | "birthday")[] {
  switch (type) {
    case "short_text":
      return ["first_name", "last_name", "full_name"];
    case "email":
      return ["email"];
    case "phone":
      return ["phone"];
    case "date":
      return ["birthday"];
    default:
      return [];
  }
}

export const MAP_LABELS: Record<string, string> = {
  first_name: "First name",
  last_name: "Last name",
  full_name: "Full name",
  email: "Email",
  phone: "Phone",
  birthday: "Birthday",
};

/** Custom field kinds an answer of this type can fill. */
export function customKindsFor(type: FormFieldType): ("text" | "number" | "date" | "yesno" | "choice")[] {
  switch (type) {
    case "short_text":
    case "email":
    case "phone":
      return ["text"];
    case "number":
    case "rating":
      return ["number", "text"];
    case "date":
      return ["date", "text"];
    case "yes_no":
      return ["yesno", "text"];
    case "dropdown":
    case "multiple_choice":
      return ["choice", "text"];
    default:
      return [];
  }
}

export function newFieldId(): string {
  return Math.random().toString(36).slice(2, 10);
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/**
 * Cleans a form definition coming from the builder: known types only, sane lengths,
 * unique ids, options where needed, and mappings that fit the field type. Throws a
 * readable message when something has to be fixed by the person editing.
 */
export function cleanDefinition(raw: unknown, customKinds: Record<string, string> = {}): FormField[] {
  if (!Array.isArray(raw)) throw new Error("The form has no fields.");
  if (raw.length > FORM_LIMITS.fieldsPerForm) throw new Error(`A form can have up to ${FORM_LIMITS.fieldsPerForm} fields.`);
  const seen = new Set<string>();
  const usedTargets = new Set<string>();
  return raw.map((r, i) => {
    const f = (r ?? {}) as Record<string, unknown>;
    const type = f.type as FormFieldType;
    if (!FIELD_TYPES.some((t) => t.type === type)) throw new Error(`Field ${i + 1} has an unknown type.`);
    let id = typeof f.id === "string" && /^[a-z0-9]{4,16}$/.test(f.id) ? f.id : newFieldId();
    while (seen.has(id)) id = newFieldId();
    seen.add(id);
    const label = str(f.label, FORM_LIMITS.labelLength);
    if (!label) throw new Error(`Field ${i + 1} needs a label.`);
    const field: FormField = { id, type, label };
    const description = typeof f.description === "string" ? f.description.trim().slice(0, FORM_LIMITS.descriptionLength) : "";
    if (description) field.description = description;
    if (!isInputField(type)) return field;
    if (f.required) field.required = true;
    const placeholder = str(f.placeholder, 120);
    if (placeholder) field.placeholder = placeholder;
    if (hasOptions(type)) {
      const options = Array.isArray(f.options) ? [...new Set(f.options.map((o) => str(o, FORM_LIMITS.optionLength)).filter(Boolean))] : [];
      if (options.length === 0) throw new Error(`“${label}” needs at least one option.`);
      if (options.length > FORM_LIMITS.optionsPerField) throw new Error(`“${label}” can have up to ${FORM_LIMITS.optionsPerField} options.`);
      field.options = options;
    }
    if (type === "number") {
      if (typeof f.min === "number" && Number.isFinite(f.min)) field.min = f.min;
      if (typeof f.max === "number" && Number.isFinite(f.max)) field.max = f.max;
      if (field.min !== undefined && field.max !== undefined && field.min > field.max) throw new Error(`“${label}”: the minimum is above the maximum.`);
    }
    if (type === "short_text" || type === "long_text") {
      const cap = type === "short_text" ? FORM_LIMITS.shortText : FORM_LIMITS.longText;
      if (typeof f.maxLength === "number" && f.maxLength >= 1) field.maxLength = Math.min(cap, Math.floor(f.maxLength));
    }
    const target = typeof f.mapTo === "string" ? f.mapTo : null;
    if (target) {
      const ok = target.startsWith("custom:")
        ? (customKindsFor(type) as string[]).includes(customKinds[target.slice(7)] ?? "")
        : (mapTargetsFor(type) as string[]).includes(target);
      if (!ok) throw new Error(`“${label}” can't fill that profile field.`);
      if (usedTargets.has(target)) throw new Error(`Two fields fill the same profile field (${MAP_LABELS[target] ?? "a custom field"}).`);
      usedTargets.add(target);
      field.mapTo = target as MapTarget;
    }
    return field;
  });
}

export function cleanSettings(raw: unknown): FormSettings {
  const s = (raw ?? {}) as Record<string, unknown>;
  const intake: IntakeMode = s.intake === "auto" || s.intake === "none" ? s.intake : "review";
  const closesAt = typeof s.closesAt === "string" && !Number.isNaN(Date.parse(s.closesAt)) ? new Date(s.closesAt).toISOString() : null;
  const max = Number(s.maxSubmissions);
  const keep = Number(s.retentionDays);
  return {
    intake,
    assignTo: typeof s.assignTo === "string" && /^[0-9a-f-]{36}$/i.test(s.assignTo) ? s.assignTo : null,
    closesAt,
    maxSubmissions: Number.isInteger(max) && max >= 1 && max <= 100000 ? max : null,
    retentionDays: Number.isInteger(keep) && keep >= 7 && keep <= 3650 ? keep : null,
    successMessage: str(s.successMessage, FORM_LIMITS.successMessage) || DEFAULT_SETTINGS.successMessage,
  };
}

export type Answer = string | string[] | boolean | number;
export type Answers = Record<string, Answer>;

const EMAIL_RE = /^[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,}$/i;

/**
 * Checks a public submission against the form's own definition. Only known fields are
 * kept; every value is typed, trimmed and length-capped. Returns per-field errors
 * (shown next to the field) instead of throwing.
 */
export function validateSubmission(fields: FormField[], raw: Record<string, unknown>): { answers: Answers; errors: Record<string, string> } {
  const answers: Answers = {};
  const errors: Record<string, string> = {};
  for (const f of fields) {
    if (!isInputField(f.type)) continue;
    const v = raw[f.id];
    const text = typeof v === "string" ? v.replace(/\r\n?/g, "\n").trim() : "";
    const missing = () => {
      if (f.required) errors[f.id] = "Required.";
    };
    switch (f.type) {
      case "short_text":
      case "long_text": {
        if (!text) {
          missing();
          break;
        }
        const cap = Math.min(f.maxLength ?? Infinity, f.type === "short_text" ? FORM_LIMITS.shortText : FORM_LIMITS.longText);
        if (text.length > cap) errors[f.id] = `Keep it under ${cap} characters.`;
        else answers[f.id] = f.type === "short_text" ? text.replace(/\s+/g, " ") : text;
        break;
      }
      case "email":
        if (!text) missing();
        else if (text.length > 254 || !EMAIL_RE.test(text)) errors[f.id] = "Enter a valid email.";
        else answers[f.id] = text.toLowerCase();
        break;
      case "phone": {
        if (!text) {
          missing();
          break;
        }
        const digits = text.replace(/\D/g, "");
        if (digits.length < 7 || digits.length > 15 || !/^[+\d\s().-]+$/.test(text)) errors[f.id] = "Enter a valid phone number.";
        else answers[f.id] = text.replace(/\s+/g, " ").slice(0, 30);
        break;
      }
      case "number":
      case "rating": {
        if (!text) {
          missing();
          break;
        }
        const n = Number(text);
        const min = f.type === "rating" ? 1 : f.min;
        const max = f.type === "rating" ? 5 : f.max;
        if (!Number.isFinite(n) || Math.abs(n) > 1e12) errors[f.id] = "Enter a number.";
        else if (f.type === "rating" && !Number.isInteger(n)) errors[f.id] = "Pick 1 to 5.";
        else if (min !== undefined && n < min) errors[f.id] = `At least ${min}.`;
        else if (max !== undefined && n > max) errors[f.id] = `At most ${max}.`;
        else answers[f.id] = n;
        break;
      }
      case "date":
        if (!text) missing();
        else if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T12:00:00Z`)) || text < "1900-01-01" || text > "2100-12-31")
          errors[f.id] = "Enter a date.";
        else answers[f.id] = text;
        break;
      case "time":
        if (!text) missing();
        else if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) errors[f.id] = "Enter a time.";
        else answers[f.id] = text;
        break;
      case "dropdown":
      case "multiple_choice":
        if (!text) missing();
        else if (!f.options?.includes(text)) errors[f.id] = "Pick one of the options.";
        else answers[f.id] = text;
        break;
      case "checkboxes": {
        const list = (Array.isArray(v) ? v : typeof v === "string" && v ? [v] : []).filter((x): x is string => typeof x === "string");
        const picked = [...new Set(list)].filter((x) => f.options?.includes(x));
        if (picked.length !== new Set(list).size) errors[f.id] = "Pick from the options.";
        else if (!picked.length) missing();
        else answers[f.id] = picked;
        break;
      }
      case "yes_no":
        if (text !== "yes" && text !== "no") {
          if (text) errors[f.id] = "Pick yes or no.";
          else missing();
        } else answers[f.id] = text;
        break;
      case "consent":
        if (v === true || text === "on" || text === "yes" || text === "true") answers[f.id] = true;
        else if (f.required) errors[f.id] = "Please check this box to continue.";
        break;
    }
  }
  return { answers, errors };
}

/** How an answer reads on screen and in the intake note. */
export function answerText(field: FormField, a: Answer | undefined): string {
  if (a === undefined || a === null || a === "") return "";
  if (Array.isArray(a)) return a.join(", ");
  if (field.type === "yes_no") return a === "yes" ? "Yes" : "No";
  if (field.type === "consent") return a ? "Agreed" : "";
  if (field.type === "rating") return `${a} / 5`;
  return String(a);
}

export type ProfileDraft = {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  birthday: string | null;
  custom: Record<string, string>;
  /** Everything not mapped, as "Question: answer" lines for the intake note. */
  noteLines: string[];
};

/** Turns answers into the profile fields the form maps to, plus a note with the rest. */
export function profileFromAnswers(fields: FormField[], answers: Answers): ProfileDraft {
  const d: ProfileDraft = { firstName: null, lastName: null, email: null, phone: null, birthday: null, custom: {}, noteLines: [] };
  for (const f of fields) {
    if (!isInputField(f.type)) continue;
    const a = answers[f.id];
    const text = answerText(f, a);
    if (!text) continue;
    const t = f.mapTo;
    if (t === "first_name") d.firstName = text.slice(0, 100);
    else if (t === "last_name") d.lastName = text.slice(0, 100);
    else if (t === "full_name") {
      const [first, ...rest] = text.split(" ");
      d.firstName ??= first.slice(0, 100);
      if (rest.length) d.lastName ??= rest.join(" ").slice(0, 100);
    } else if (t === "email") d.email = text;
    else if (t === "phone") d.phone = text;
    else if (t === "birthday") d.birthday = text;
    else if (t && t.startsWith("custom:")) d.custom[t.slice(7)] = f.type === "yes_no" ? String(a) : text;
    else d.noteLines.push(`${f.label}: ${text}`);
  }
  return d;
}

export const displayName = (d: Pick<ProfileDraft, "firstName" | "lastName">) => [d.firstName, d.lastName].filter(Boolean).join(" ").trim();

/** Digits only, without a leading US country code, for duplicate checks. */
export function phoneKey(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 7) return null;
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}
