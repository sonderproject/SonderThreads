import { query, queryOne } from "@/lib/db/client";

export type ReferralStatus = "new" | "accepted" | "matched" | "declined";
export const STATUS_LABELS: Record<ReferralStatus, string> = {
  new: "Waiting",
  accepted: "Accepted",
  matched: "Already a client",
  declined: "Declined",
};

export type ReferralRow = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  dob: string | Date | null;
  referrer_name: string;
  referrer_department: string;
  status: ReferralStatus;
  person_id: string | null;
  decline_reason: string | null;
  handled_by_name: string | null;
  handled_at: string | null;
  created_at: string;
  appointment_at: string | null;
  waitlisted: boolean;
  services: string[] | null;
  notes: string | null;
  referrer_email: string | null;
};

export type LogFilters = { dept?: string | null; from?: string | null; to?: string | null; service?: string | null };

/** YYYY-MM-DD for a `date` column (node-postgres returns a local-midnight Date). */
export function dateOnly(v: string | Date | null): string {
  if (!v) return "";
  if (typeof v === "string") return v.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
}

/** "Mar 4, 1990" for a date of birth. */
export function formatDob(v: string | Date | null): string {
  const s = dateOnly(v);
  if (!s) return "";
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The referral log for an organization (newest first). Callers must check the viewer is an admin. */
export async function listReferrals(orgId: string, f: LogFilters = {}, status?: ReferralStatus): Promise<ReferralRow[]> {
  return query<ReferralRow>(
    `select r.id, r.first_name, r.last_name, r.phone, r.dob, r.referrer_name, r.referrer_department, r.status,
            r.person_id, r.decline_reason, coalesce(u.name, u.email) as handled_by_name, r.handled_at, r.created_at,
            r.appointment_at, r.waitlisted, r.services, r.notes, r.referrer_email
       from referrals r left join users u on u.id = r.handled_by
      where r.org_id = $1
        and ($2::text is null or lower(trim(r.referrer_department)) = lower(trim($2)))
        and ($3::date is null or r.created_at >= $3::date)
        and ($4::date is null or r.created_at < $4::date + 1)
        and ($5::text is null or r.status = $5)
        and ($6::text is null or $6 = any(r.services))
      order by r.created_at ${status === "new" ? "asc" : "desc"}
      limit 2000`,
    [orgId, f.dept || null, f.from && DAY.test(f.from) ? f.from : null, f.to && DAY.test(f.to) ? f.to : null, status ?? null, f.service || null],
  );
}

export async function countNewReferrals(orgId: string): Promise<number> {
  const row = await queryOne<{ n: number }>(`select count(*)::int as n from referrals where org_id = $1 and status = 'new'`, [orgId]);
  return row?.n ?? 0;
}

/** Departments that have referred, for the filter. */
export async function listReferralDepartments(orgId: string): Promise<string[]> {
  const rows = await query<{ d: string }>(
    `select min(trim(referrer_department)) as d from referrals where org_id = $1
      group by lower(trim(referrer_department)) order by 1`,
    [orgId],
  );
  return rows.map((r) => r.d);
}

/** Organization clients who might be the same person as a referral (same name, or same last name and birthday). */
export async function findLikelyMatches(
  orgId: string,
  r: Pick<ReferralRow, "first_name" | "last_name" | "dob">,
): Promise<{ id: string; display_name: string; birthday: string | Date | null; phone: string | null }[]> {
  return query(
    `select id, display_name, birthday, phone from people
      where org_id = $1 and deleted_at is null
        and ((lower(first_name) = lower($2) and lower(coalesce(last_name, '')) = lower($3))
             or lower(display_name) = lower($2 || ' ' || $3)
             or ($4::date is not null and birthday = $4::date and lower(coalesce(last_name, '')) = lower($3)))
      order by display_name limit 5`,
    [orgId, r.first_name, r.last_name, dateOnly(r.dob) || null],
  );
}
