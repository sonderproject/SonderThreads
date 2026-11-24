import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { query, queryOne } from "@/lib/db/client";
import { actorQueryOne } from "@/lib/db/scope";
import { getAppSettings, inMaintenance } from "@/lib/app-settings";
import { cleanFieldValue, type FieldKind } from "@/lib/custom-fields-shared";
import {
  DEFAULT_SETTINGS,
  FORM_LIMITS,
  cleanSettings,
  displayName,
  phoneKey,
  profileFromAnswers,
  validateSubmission,
  type Answers,
  type FormField,
  type FormSettings,
  type ProfileDraft,
} from "@/lib/forms-shared";

/**
 * Smart forms, the server side that runs without a signed-in user: the public form,
 * spam and rate checks, duplicate detection and creating a profile from a submission.
 * Answers never leave this file except into the database: never into URLs, analytics,
 * logs or notification text.
 */

export type PublicForm = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  fields: FormField[];
  settings: FormSettings;
  /** Who the form is from (organization name, or the person's name). */
  from: string | null;
  /** null when open, otherwise why it isn't taking answers. */
  closed: null | "paused" | "closed" | "full" | "maintenance";
};

type FormRow = {
  id: string;
  user_id: string;
  org_id: string | null;
  code: string;
  name: string;
  description: string | null;
  status: string;
  fields: FormField[];
  settings: Partial<FormSettings> | null;
  org_name: string | null;
  owner_name: string | null;
};

async function loadByCode(code: string): Promise<FormRow | null> {
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(code)) return null;
  return queryOne<FormRow>(
    `select f.id, f.user_id, f.org_id, f.code, f.name, f.description, f.status, f.fields, f.settings,
            o.name as org_name, u.name as owner_name
       from forms f
       join users u on u.id = f.user_id
       left join organizations o on o.id = f.org_id
      where f.code = $1 and f.deleted_at is null
        and f.org_id is not null -- forms are a Business feature (lib/plan.ts)
        and f.status in ('published', 'paused')
        and u.suspended_at is null and (o.id is null or o.suspended_at is null)`,
    [code],
  );
}

async function closedReason(f: FormRow, settings: FormSettings): Promise<PublicForm["closed"]> {
  if (f.status === "paused") return "paused";
  if (settings.closesAt && new Date(settings.closesAt).getTime() <= Date.now()) return "closed";
  if (settings.maxSubmissions) {
    const n = await queryOne<{ n: number }>(`select count(*)::int as n from form_submissions where form_id = $1`, [f.id]);
    if ((n?.n ?? 0) >= settings.maxSubmissions) return "full";
  }
  if (inMaintenance(await getAppSettings())) return "maintenance";
  return null;
}

/** The public view of a form, or null if the link doesn't exist (or was turned off). */
export async function publicForm(code: string): Promise<PublicForm | null> {
  const f = await loadByCode(code);
  if (!f) return null;
  const settings = cleanSettings({ ...DEFAULT_SETTINGS, ...(f.settings ?? {}) });
  return {
    id: f.id,
    code: f.code,
    name: f.name,
    description: f.description,
    fields: f.fields,
    settings,
    from: f.org_name ?? f.owner_name?.trim() ?? null,
    closed: await closedReason(f, settings),
  };
}

/** Counts a view (one number per form per day; nothing about the visitor). */
export async function recordView(formId: string): Promise<void> {
  await query(
    `insert into form_views (form_id, day, views) values ($1, current_date, 1)
     on conflict (form_id, day) do update set views = form_views.views + 1`,
    [formId],
  );
}

/* ------------------------------------------------------------------ */
/* Spam protection                                                     */
/* ------------------------------------------------------------------ */

function secret(): string {
  return process.env.CRON_SECRET || (process.env.NODE_ENV === "production" ? "" : "dev-only");
}

/** A signed "form opened at" stamp, so a bot can't claim it spent longer on the form than it did. */
export function startStamp(formId: string, now = Date.now()): string {
  const s = secret();
  const t = String(now);
  if (!s) return t;
  return `${t}.${createHmac("sha256", s).update(`form:${formId}:${t}`).digest("base64url").slice(0, 22)}`;
}

/** Seconds since the form was opened, or null if the stamp is missing or forged. */
export function secondsSince(formId: string, stamp: string, now = Date.now()): number | null {
  const [t, sig] = stamp.split(".");
  if (!/^\d{12,14}$/.test(t ?? "")) return null;
  const s = secret();
  if (s) {
    const want = createHmac("sha256", s).update(`form:${formId}:${t}`).digest("base64url").slice(0, 22);
    if (!sig || sig.length !== want.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  }
  const secs = Math.floor((now - Number(t)) / 1000);
  return secs >= 0 && secs < 60 * 60 * 24 ? secs : null;
}

export function ipHashFor(ip: string): string {
  return createHash("sha256").update(`form:${ip}`).digest("hex");
}

/* ------------------------------------------------------------------ */
/* Duplicates and profiles                                             */
/* ------------------------------------------------------------------ */

/** Where a form's people live: the organization, or the solo account. */
export type FormOwner = { userId: string; orgId: string | null };

/** Existing people who may be the same person (same email, phone or exact name). Never more than 5. */
export async function findDuplicates(owner: FormOwner, d: Pick<ProfileDraft, "firstName" | "lastName" | "email" | "phone">): Promise<string[]> {
  const email = d.email?.toLowerCase() ?? null;
  const phone = phoneKey(d.phone);
  const name = displayName(d).toLowerCase() || null;
  if (!email && !phone && !name) return [];
  const rows = await query<{ id: string }>(
    `select id from people p
      where p.deleted_at is null
        and ${owner.orgId ? "p.org_id = $1" : "p.org_id is null and p.user_id = $1"}
        and (($2::text is not null and lower(p.email) = $2)
          or ($3::text is not null and (case when length(regexp_replace(coalesce(p.phone, ''), '\\D', '', 'g')) = 11
                                              and regexp_replace(p.phone, '\\D', '', 'g') like '1%'
                                             then substr(regexp_replace(p.phone, '\\D', '', 'g'), 2)
                                             else regexp_replace(coalesce(p.phone, ''), '\\D', '', 'g') end) = $3)
          or ($4::text is not null and $5 and lower(p.display_name) = $4))
      order by p.created_at desc
      limit 5`,
    [owner.orgId ?? owner.userId, email, phone, name, Boolean(d.firstName && d.lastName)],
  );
  return rows.map((r) => r.id);
}

/**
 * Who a new profile from this form belongs to. Always someone active in the form's
 * organization (so a profile can never land in another organization or in a former
 * member's personal account): the assignee, else the form's owner, else an Admin.
 */
export async function profileOwner(form: { user_id: string; org_id: string | null }, assignTo: string | null): Promise<string | null> {
  if (!form.org_id) return form.user_id;
  const row = await queryOne<{ user_id: string }>(
    `select user_id from memberships
      where org_id = $1 and active and user_id in ($2::uuid, $3::uuid)
      order by (user_id = $2::uuid) desc limit 1`,
    [form.org_id, assignTo ?? form.user_id, form.user_id],
  );
  if (row) return row.user_id;
  const admin = await queryOne<{ user_id: string }>(
    `select user_id from memberships where org_id = $1 and active and role = 'admin' order by created_at limit 1`,
    [form.org_id],
  );
  return admin?.user_id ?? null;
}

/** Custom field values from a draft, checked against the account's own fields (unknown or retired ones are dropped). */
async function cleanCustom(owner: FormOwner, custom: Record<string, string>): Promise<Record<string, string>> {
  const ids = Object.keys(custom).filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (ids.length === 0) return {};
  const fields = await query<{ id: string; label: string; kind: FieldKind; options: string[] | null }>(
    `select id, label, kind, options from custom_fields
      where ${owner.orgId ? "org_id = $1" : "org_id is null and user_id = $1"} and id = any($2::uuid[]) and archived_at is null`,
    [owner.orgId ?? owner.userId, ids],
  );
  const out: Record<string, string> = {};
  for (const f of fields) {
    try {
      const v = cleanFieldValue({ kind: f.kind, options: f.options ?? [], label: f.label }, custom[f.id]);
      if (v !== null) out[f.id] = v;
    } catch {
      // A value that doesn't fit the field stays in the submission, not on the profile.
    }
  }
  return out;
}

/** The intake note: where they came from plus every answer not mapped to a profile field. */
export function intakeNote(formName: string, at: Date, d: ProfileDraft): string {
  const when = at.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return [`From the form "${formName}" on ${when}.`, ...d.noteLines].join("\n").slice(0, 10000);
}

/**
 * Creates a new profile from a submission. Never touches an existing profile.
 * `actorId` is who did it (the reviewer), for the audit log; null for automatic intake.
 */
export async function createProfile(opts: {
  ownerId: string;
  orgId: string | null;
  formName: string;
  submittedAt: Date;
  draft: ProfileDraft;
  actorId: string | null;
}): Promise<string> {
  const { ownerId, orgId, draft } = opts;
  const first = draft.firstName?.trim() || "New";
  const last = draft.lastName?.trim() || null;
  const custom = await cleanCustom({ userId: ownerId, orgId }, draft.custom);
  const run = <T extends Record<string, unknown>>(sql: string, params: unknown[]) =>
    opts.actorId ? actorQueryOne<T>(opts.actorId, sql, params) : queryOne<T>(sql, params);
  const person = await run<{ id: string }>(
    `insert into people (user_id, org_id, first_name, last_name, display_name, email, phone, birthday, custom_fields)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
    [ownerId, orgId, first, last, [first, last].filter(Boolean).join(" "), draft.email, draft.phone, draft.birthday, JSON.stringify(custom)],
  );
  if (!person) throw new Error("Couldn't create the profile.");
  await query(`insert into activity (user_id, type, description, person_id) values ($1, 'person_created', $2, $3)`, [
    ownerId,
    `${[first, last].filter(Boolean).join(" ")} added from the form "${opts.formName}"`,
    person.id,
  ]);
  await addIntakeNote(ownerId, person.id, intakeNote(opts.formName, opts.submittedAt, draft));
  return person.id;
}

/** Adds the intake note to a profile (also used when a submission is linked to someone who's already there). */
export async function addIntakeNote(userId: string, personId: string, content: string): Promise<void> {
  const note = await queryOne<{ id: string }>(
    `insert into notes (user_id, content, person_id, category) values ($1, $2, $3, 'form') returning id`,
    [userId, content, personId],
  );
  await query(`insert into activity (user_id, type, description, person_id, note_id) values ($1, 'note_added', $2, $3, $4)`, [
    userId,
    `Note: ${content.split("\n")[0]}`,
    personId,
    note?.id ?? null,
  ]);
  await query(`update people set last_activity_at = now() where id = $1`, [personId]);
}

/* ------------------------------------------------------------------ */
/* Accepting a submission                                              */
/* ------------------------------------------------------------------ */

export type SubmitResult =
  | { ok: true; message: string }
  | { ok: false; reason: "gone" | PublicForm["closed"] | "busy" | "invalid"; errors?: Record<string, string> };

/** Who hears about a new submission: the assignee, or the organization's Admins and Managers (or the solo owner). */
async function recipients(form: { user_id: string; org_id: string | null }, assignee: string | null): Promise<string[]> {
  if (!form.org_id) return [form.user_id];
  if (assignee) return [assignee];
  const rows = await query<{ user_id: string }>(
    `select user_id from memberships where org_id = $1 and active and role in ('admin', 'supervisor')`,
    [form.org_id],
  );
  return rows.map((r) => r.user_id);
}

/**
 * The whole public submission: open check, spam trap, timing, rate limits, validation,
 * storing, intake and notifications. `notifyFn` is injected so tests don't send anything.
 */
export async function acceptSubmission(opts: {
  code: string;
  raw: Record<string, unknown>;
  ipHash: string;
  stamp: string;
  honeypot: string;
  notifyFn?: (userId: string, n: { type: string; title: string; body: string; href: string; channels?: ("push" | "sms")[] }) => Promise<void>;
  now?: number;
}): Promise<SubmitResult> {
  const f = await loadByCode(opts.code);
  if (!f || f.status !== "published") return { ok: false, reason: f ? "paused" : "gone" };
  const settings = cleanSettings({ ...DEFAULT_SETTINGS, ...(f.settings ?? {}) });
  const closed = await closedReason(f, settings);
  if (closed) return { ok: false, reason: closed };


  const { answers, errors } = validateSubmission(f.fields, opts.raw);
  if (Object.keys(errors).length) return { ok: false, reason: "invalid", errors };

  // Bots: the hidden field is filled, or the form came back faster than a person can type.
  // They're shown the normal thank-you page, and nothing is saved.
  const secs = secondsSince(f.id, opts.stamp, opts.now);
  if (opts.honeypot.trim() || secs === null || secs < FORM_LIMITS.minSeconds) return { ok: true, message: settings.successMessage };

  const counts = await queryOne<{ ip: number; form: number }>(
    `select (select count(*) from form_submissions where ip_hash = $1 and created_at > now() - interval '1 hour')::int as ip,
            (select count(*) from form_submissions where form_id = $2 and created_at > now() - interval '1 day')::int as form`,
    [opts.ipHash, f.id],
  );
  if ((counts?.ip ?? 0) >= FORM_LIMITS.perNetworkPerHour || (counts?.form ?? 0) >= FORM_LIMITS.perFormPerDay) return { ok: false, reason: "busy" };


  const draft = profileFromAnswers(f.fields, answers);
  const owner: FormOwner = { userId: f.user_id, orgId: f.org_id };
  const collects = Boolean(draft.firstName || draft.email || draft.phone);
  const duplicates = settings.intake !== "none" && collects ? await findDuplicates(owner, draft) : [];
  const assignee = f.org_id && settings.assignTo ? await profileOwner(f, settings.assignTo) : null;
  const assignedTo = assignee && assignee === settings.assignTo ? assignee : null;

  const status = settings.intake === "none" || !collects ? "new" : duplicates.length || settings.intake === "review" ? "needs_review" : "approved";
  const sub = await queryOne<{ id: string; created_at: Date }>(
    `insert into form_submissions (form_id, user_id, org_id, answers, fields, status, duplicate_ids, assigned_to, ip_hash, seconds_to_complete)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id, created_at`,
    [f.id, f.user_id, f.org_id, JSON.stringify(answers), JSON.stringify(f.fields), status, duplicates, assignedTo, opts.ipHash, secs],
  );
  if (!sub) throw new Error("Couldn't save the submission.");

  // Automatic intake: a new profile when nobody matches. Anything uncertain waits for review.
  let personId: string | null = null;
  if (status === "approved" && draft.firstName) {
    const ownerId = await profileOwner(f, settings.assignTo);
    if (ownerId) {
      personId = await createProfile({ ownerId, orgId: f.org_id, formName: f.name, submittedAt: sub.created_at, draft, actorId: null });
      await query(`update form_submissions set person_id = $1, reviewed_at = now() where id = $2`, [personId, sub.id]);
    } else {
      await query(`update form_submissions set status = 'needs_review' where id = $1`, [sub.id]);
    }
  } else if (status === "approved") {
    await query(`update form_submissions set status = 'needs_review' where id = $1`, [sub.id]);
  }

  // Notifications say which form, never what was answered.
  const send = opts.notifyFn ?? (async (userId, n) => (await import("@/lib/notify")).notify(userId, n));
  const title = personId ? `New profile from "${f.name}"` : `New response to "${f.name}"`;
  const body = duplicates.length ? "May match someone you already have. Review it before adding." : status === "needs_review" ? "Waiting for review." : "";
  for (const userId of await recipients(f, assignedTo)) {
    try {
      await send(userId, { type: "form_submission", title, body, href: `/forms/submissions/${sub.id}`, channels: ["push"] });
    } catch {
      // A failed alert never loses the submission.
    }
  }
  return { ok: true, message: settings.successMessage };
}

export type { Answers };

/**
 * Retention (run by the 5-minute cron): erases responses older than their form's
 * "Keep responses" setting. Profiles and notes already added are kept. Returns how many.
 */
export async function purgeExpiredSubmissions(): Promise<number> {
  const rows = await query<{ id: string }>(
    `update form_submissions x set deleted_at = now(), answers = '{}'::jsonb
       from forms f
      where f.id = x.form_id and x.deleted_at is null
        and (f.settings->>'retentionDays') ~ '^[0-9]{1,4}$'
        and x.created_at < now() - make_interval(days => (f.settings->>'retentionDays')::int)
        and x.id in (select id from form_submissions where deleted_at is null order by created_at limit 1000)
      returning x.id`,
  );
  return rows.length;
}
