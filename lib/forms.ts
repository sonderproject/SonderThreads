import { query, queryOne } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { notFound } from "next/navigation";
import { getMembership } from "@/lib/org";
import { formFilter, submissionVisibility, type FormScope } from "@/lib/forms-scope";

export { formFilter, submissionVisibility, type FormScope };
import {
  DEFAULT_SETTINGS,
  answerText,
  cleanSettings,
  displayName,
  isInputField,
  profileFromAnswers,
  type Answers,
  type FormField,
  type FormSettings,
  type FormStatus,
  type SubmissionStatus,
} from "@/lib/forms-shared";

/**
 * Smart forms for signed-in people. An organization shares its forms: every member can
 * see and share them, Admins and Managers build them and see every submission, a Member
 * sees only the submissions assigned to them. A solo account has its own.
 */
export async function formScope(): Promise<FormScope> {
  const userId = await requireUserId();
  const m = await getMembership();
  // Forms and automations are Business features (lib/plan.ts): individuals never reach them.
  if (!m?.active) notFound();
  return { userId, orgId: m!.orgId, canManage: m!.role === "admin" || m!.role === "supervisor" };
}

export type FormSummary = {
  id: string;
  name: string;
  status: FormStatus;
  code: string;
  fieldCount: number;
  submissions: number;
  toReview: number;
  views: number;
  lastAt: string | null;
  updatedAt: string;
};

export async function listForms(): Promise<FormSummary[]> {
  const s = await formScope();
  const { where, param } = formFilter(s, "f.");
  const rows = await query<{
    id: string;
    name: string;
    status: FormStatus;
    code: string;
    field_count: number;
    submissions: number;
    to_review: number;
    views: number;
    last_at: string | null;
    updated_at: string;
  }>(
    `select f.id, f.name, f.status, f.code, jsonb_array_length(f.fields)::int as field_count, f.updated_at,
            (select count(*) from form_submissions x where x.form_id = f.id and x.deleted_at is null and ${submissionVisibility(s, "x.")})::int as submissions,
            (select count(*) from form_submissions x where x.form_id = f.id and x.deleted_at is null and x.status in ('new', 'needs_review')
               and ${submissionVisibility(s, "x.")})::int as to_review,
            (select coalesce(sum(views), 0) from form_views v where v.form_id = f.id)::int as views,
            (select max(created_at) from form_submissions x where x.form_id = f.id and x.deleted_at is null) as last_at
       from forms f
      where ${where} and f.deleted_at is null
      order by (f.status = 'archived'), f.updated_at desc`,
    [param, s.userId],
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    code: r.code,
    fieldCount: r.field_count,
    submissions: r.submissions,
    toReview: r.to_review,
    views: r.views,
    lastAt: r.last_at,
    updatedAt: r.updated_at,
  }));
}

export type FormDetail = {
  id: string;
  name: string;
  description: string | null;
  status: FormStatus;
  code: string;
  fields: FormField[];
  settings: FormSettings;
  updatedAt: string;
};

type FormRow = {
  id: string;
  name: string;
  description: string | null;
  status: FormStatus;
  code: string;
  fields: FormField[];
  settings: Partial<FormSettings> | null;
  updated_at: string;
};

export async function getForm(id: string): Promise<FormDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const s = await formScope();
  const { where, param } = formFilter(s);
  const r = await queryOne<FormRow>(
    `select id, name, description, status, code, fields, settings, updated_at from forms where ${where} and id = $2 and deleted_at is null`,
    [param, id],
  );
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    status: r.status,
    code: r.code,
    fields: r.fields ?? [],
    settings: cleanSettings({ ...DEFAULT_SETTINGS, ...(r.settings ?? {}) }),
    updatedAt: r.updated_at,
  };
}

/* ------------------------------------------------------------------ */
/* Submissions                                                         */
/* ------------------------------------------------------------------ */

export type SubmissionRow = {
  id: string;
  formId: string;
  formName: string;
  status: SubmissionStatus;
  /** The name the person gave (from the mapped name fields), or null. */
  name: string | null;
  contact: string | null;
  personId: string | null;
  personName: string | null;
  duplicates: number;
  assignedTo: string | null;
  assigneeName: string | null;
  createdAt: string;
};

type SubRow = {
  id: string;
  form_id: string;
  form_name: string;
  status: SubmissionStatus;
  answers: Answers;
  fields: FormField[];
  person_id: string | null;
  person_name: string | null;
  duplicate_ids: string[];
  assigned_to: string | null;
  assignee_name: string | null;
  created_at: string;
};

const SUB_SELECT = `
  select x.id, x.form_id, f.name as form_name, x.status, x.answers, x.fields, x.person_id,
         p.display_name as person_name, x.duplicate_ids, x.assigned_to, u.name as assignee_name, x.created_at,
         r.name as reviewer, x.reviewed_at, x.seconds_to_complete
    from form_submissions x
    join forms f on f.id = x.form_id
    left join people p on p.id = x.person_id and p.deleted_at is null
    left join users u on u.id = x.assigned_to
    left join users r on r.id = x.reviewed_by`;

function toRow(r: SubRow): SubmissionRow {
  const d = profileFromAnswers(r.fields ?? [], r.answers ?? {});
  return {
    id: r.id,
    formId: r.form_id,
    formName: r.form_name,
    status: r.status,
    name: displayName(d) || null,
    contact: d.email ?? d.phone ?? null,
    personId: r.person_id,
    personName: r.person_name,
    duplicates: (r.duplicate_ids ?? []).length,
    assignedTo: r.assigned_to,
    assigneeName: r.assignee_name,
    createdAt: r.created_at,
  };
}

export type SubmissionFilters = { formId?: string; status?: SubmissionStatus | "open"; q?: string; from?: string; to?: string };

export async function listSubmissions(filters: SubmissionFilters = {}, limit = 200): Promise<SubmissionRow[]> {
  const s = await formScope();
  const { where, param } = formFilter(s, "x.");
  const params: unknown[] = [param, s.userId];
  const conds = [where, "x.deleted_at is null", submissionVisibility(s, "x.")];
  if (filters.formId && /^[0-9a-f-]{36}$/i.test(filters.formId)) {
    params.push(filters.formId);
    conds.push(`x.form_id = $${params.length}`);
  }
  if (filters.status === "open") conds.push(`x.status in ('new', 'needs_review')`);
  else if (filters.status) {
    params.push(filters.status);
    conds.push(`x.status = $${params.length}`);
  }
  if (filters.from && /^\d{4}-\d{2}-\d{2}$/.test(filters.from)) {
    params.push(filters.from);
    conds.push(`x.created_at >= $${params.length}::date`);
  }
  if (filters.to && /^\d{4}-\d{2}-\d{2}$/.test(filters.to)) {
    params.push(filters.to);
    conds.push(`x.created_at < $${params.length}::date + 1`);
  }
  const q = filters.q?.trim().toLowerCase().slice(0, 80);
  if (q) {
    // Searches the answers themselves (names, emails, anything typed), inside the visible set only.
    params.push(`%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    conds.push(`(lower(x.answers::text) like $${params.length} or lower(coalesce(p.display_name, '')) like $${params.length})`);
  }
  params.push(Math.min(Math.max(limit, 1), 500));
  const rows = await query<SubRow>(`${SUB_SELECT} where ${conds.join(" and ")} order by x.created_at desc limit $${params.length}`, params);
  return rows.map(toRow);
}

export type SubmissionDetail = SubmissionRow & {
  answers: { id: string; label: string; type: string; text: string }[];
  possibleMatches: { id: string; name: string; email: string | null; phone: string | null }[];
  reviewedBy: string | null;
  reviewedAt: string | null;
  secondsToComplete: number | null;
};

export async function getSubmission(id: string): Promise<SubmissionDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const s = await formScope();
  const { where, param } = formFilter(s, "x.");
  const r = await queryOne<SubRow & { reviewer: string | null; reviewed_at: string | null; seconds_to_complete: number | null }>(
    `${SUB_SELECT}
     where ${where} and x.deleted_at is null and ${submissionVisibility(s, "x.")} and x.id = $3`,
    [param, s.userId, id],
  );
  if (!r) return null;
  const matches = r.duplicate_ids?.length
    ? await query<{ id: string; display_name: string; email: string | null; phone: string | null }>(
        `select id, display_name, email, phone from people
          where id = any($1::uuid[]) and deleted_at is null and ${s.orgId ? "org_id = $2" : "org_id is null and user_id = $2"}`,
        [r.duplicate_ids, s.orgId ?? s.userId],
      )
    : [];
  return {
    ...toRow(r),
    answers: (r.fields ?? [])
      .filter((f) => isInputField(f.type))
      .map((f) => ({ id: f.id, label: f.label, type: f.type, text: answerText(f, r.answers?.[f.id]) })),
    possibleMatches: matches.map((m) => ({ id: m.id, name: m.display_name, email: m.email, phone: m.phone })),
    reviewedBy: r.reviewer,
    reviewedAt: r.reviewed_at,
    secondsToComplete: r.seconds_to_complete,
  };
}

/* ------------------------------------------------------------------ */
/* Analytics (counts only)                                             */
/* ------------------------------------------------------------------ */

export type FormStats = {
  views: number;
  submissions: number;
  /** Submissions ÷ views, 0–100, or null with no views yet. */
  completionRate: number | null;
  medianSeconds: number | null;
  byStatus: Record<SubmissionStatus, number>;
  /** Last 30 days, oldest first. */
  daily: { day: string; views: number; submissions: number }[];
  profilesCreated: number;
};

export async function formStats(formId: string): Promise<FormStats | null> {
  const form = await getForm(formId);
  if (!form) return null;
  const s = await formScope();
  const vis = submissionVisibility(s, "x.");
  const [totals, status, daily] = await Promise.all([
    queryOne<{ views: number; submissions: number; median: number | null; created: number }>(
      `select (select coalesce(sum(views), 0) from form_views where form_id = $1)::int as views,
              (select count(*) from form_submissions x where x.form_id = $1 and x.deleted_at is null and ${vis})::int as submissions,
              (select percentile_cont(0.5) within group (order by seconds_to_complete) from form_submissions x
                where x.form_id = $1 and x.deleted_at is null and ${vis})::int as median,
              (select count(*) from form_submissions x where x.form_id = $1 and x.deleted_at is null and x.person_id is not null and ${vis})::int as created`,
      [formId, s.userId],
    ),
    query<{ status: SubmissionStatus; n: number }>(
      `select status, count(*)::int as n from form_submissions x where x.form_id = $1 and x.deleted_at is null and ${vis} group by status`,
      [formId, s.userId],
    ),
    query<{ day: string; views: number; submissions: number }>(
      `select to_char(d, 'YYYY-MM-DD') as day,
              coalesce((select views from form_views where form_id = $1 and day = d::date), 0)::int as views,
              (select count(*) from form_submissions x where x.form_id = $1 and x.deleted_at is null and ${vis}
                 and x.created_at >= d and x.created_at < d + interval '1 day')::int as submissions
         from generate_series(current_date - 29, current_date, interval '1 day') d order by d`,
      [formId, s.userId],
    ),
  ]);
  const byStatus = { new: 0, needs_review: 0, approved: 0, processed: 0, rejected: 0 } as Record<SubmissionStatus, number>;
  for (const r of status) byStatus[r.status] = r.n;
  const views = totals?.views ?? 0;
  const submissions = totals?.submissions ?? 0;
  return {
    views,
    submissions,
    completionRate: views > 0 ? Math.min(100, Math.round((submissions / views) * 100)) : null,
    medianSeconds: totals?.median ?? null,
    byStatus,
    daily,
    profilesCreated: totals?.created ?? 0,
  };
}

/** Active members a submission can be assigned to (organization only). */
export async function assignableMembers(): Promise<{ id: string; name: string }[]> {
  const s = await formScope();
  if (!s.orgId) return [];
  const rows = await query<{ id: string; name: string | null; email: string }>(
    `select u.id, u.name, u.email from memberships m join users u on u.id = m.user_id
      where m.org_id = $1 and m.active order by lower(coalesce(u.name, u.email))`,
    [s.orgId],
  );
  return rows.map((r) => ({ id: r.id, name: r.name?.trim() || r.email }));
}
