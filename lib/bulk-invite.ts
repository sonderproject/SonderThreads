import type { OrgRole } from "@/lib/org-roles";

/**
 * Bulk invites (Organization page): reads a pasted list or a CSV/spreadsheet export.
 * Each line can be just an email, or an email with a role (Admin, Manager or Member) in
 * any column; a header row and blank lines are skipped. A line with several emails and
 * no role gives each of them the default role. Safe to import in the browser.
 */
export const BULK_INVITE_MAX = 1000;

export type BulkRow = { email: string; role: OrgRole };
export type BulkParse = { rows: BulkRow[]; invalid: string[]; duplicates: number };

const EMAIL_IN_TEXT = /[^\s,;<>"'()\t]+@[^\s,;<>"'()\t]+\.[^\s,;<>"'()\t]+/g;
const EMAIL_EXACT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Role words people actually type, in any case. */
export function roleFromText(text: string): OrgRole | null {
  const t = text.trim().toLowerCase().replace(/[\s_-]+/g, " ");
  if (!t) return null;
  if (t === "admin" || t === "administrator" || t === "owner") return "admin";
  if (t === "manager" || t === "supervisor" || t === "lead" || t === "team lead") return "supervisor";
  if (t === "member" || t === "staff" || t === "user" || t === "case manager" || t === "employee") return "case_manager";
  return null;
}

export function parseBulkInvites(input: string, defaultRole: OrgRole): BulkParse {
  const seen = new Set<string>();
  const rows: BulkRow[] = [];
  const invalid: string[] = [];
  let duplicates = 0;
  const add = (raw: string, role: OrgRole) => {
    const email = raw.trim().toLowerCase().replace(/^mailto:/, "").replace(/[.,;]+$/, "");
    if (email.length > 254 || !EMAIL_EXACT.test(email)) {
      invalid.push(raw.trim().slice(0, 80));
      return;
    }
    if (seen.has(email)) {
      duplicates++;
      return;
    }
    seen.add(email);
    rows.push({ email, role });
  };
  for (const line of input.slice(0, 200_000).split(/\r?\n/)) {
    if (!line.trim()) continue;
    const emails = line.match(EMAIL_IN_TEXT) ?? [];
    const cells = line.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ""));
    if (emails.length === 0) {
      // A header row ("email,role") or a typo: report anything with an @ as invalid.
      if (line.includes("@")) invalid.push(line.trim().slice(0, 80));
      continue;
    }
    const role = emails.length === 1 ? cells.map(roleFromText).find((r) => r !== null) ?? defaultRole : defaultRole;
    for (const e of emails) add(e, role);
    if (rows.length >= BULK_INVITE_MAX) break;
  }
  return { rows: rows.slice(0, BULK_INVITE_MAX), invalid: invalid.slice(0, 50), duplicates };
}

/** The domain part of an email, lowercase. */
export function emailDomain(email: string): string {
  return email.split("@").pop()!.trim().toLowerCase();
}

/** Free webmail: never allowed as a team join link domain (anyone could join). */
export const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "hotmail.com", "outlook.com", "live.com", "msn.com",
  "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com", "gmx.com", "mail.com", "zoho.com",
  "yandex.com", "comcast.net", "att.net", "sbcglobal.net", "verizon.net",
]);

/** A team link domain list from free text ("agency.org, county.gov"): valid, non-public domains only. */
export function parseJoinDomains(text: string): { domains: string[]; rejected: string[] } {
  const domains: string[] = [];
  const rejected: string[] = [];
  for (const raw of text.split(/[\s,;]+/)) {
    const d = raw.trim().toLowerCase().replace(/^@/, "");
    if (!d) continue;
    if (!/^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(d) || PUBLIC_EMAIL_DOMAINS.has(d)) rejected.push(d);
    else if (!domains.includes(d)) domains.push(d);
  }
  return { domains: domains.slice(0, 10), rejected };
}
