"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db/client";
import { assertCanWrite } from "@/lib/billing";
import { listCustomFields } from "@/lib/custom-fields";
import { FORM_TEMPLATES } from "@/lib/form-templates";
import { formFilter, formScope, submissionVisibility, type FormScope } from "@/lib/forms";
import { addIntakeNote, createProfile, intakeNote, profileOwner } from "@/lib/forms-intake";
import {
  DEFAULT_SETTINGS,
  FORM_LIMITS,
  cleanDefinition,
  cleanSettings,
  newFieldId,
  profileFromAnswers,
  type Answers,
  type FormField,
  type FormStatus,
} from "@/lib/forms-shared";

const newCode = () => randomBytes(12).toString("base64url");
const isId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

async function requireManager(): Promise<FormScope> {
  const s = await formScope();
  if (!s.canManage) redirect("/forms?error=manage");
  return s;
}

/** A form in the signed-in person's scope, or a redirect back to the list. */
async function ownForm(s: FormScope, id: unknown): Promise<{ id: string; status: FormStatus; name: string }> {
  const { where, param } = formFilter(s);
  const f = isId(id) ? await queryOne<{ id: string; status: FormStatus; name: string }>(
    `select id, status, name from forms where ${where} and id = $2 and deleted_at is null`,
    [param, id],
  ) : null;
  if (!f) redirect("/forms?error=gone");
  return f!;
}

async function customKinds(): Promise<Record<string, string>> {
  return Object.fromEntries((await listCustomFields()).map((f) => [f.id, f.kind]));
}

/** An assignee must be an active member of the organization; anything else is dropped. */
async function checkAssignee(s: FormScope, id: string | null): Promise<string | null> {
  if (!id || !s.orgId) return null;
  const m = await queryOne(`select 1 from memberships where org_id = $1 and user_id = $2 and active`, [s.orgId, id]);
  return m ? id : null;
}

/* ------------------------------------------------------------------ */
/* Forms                                                               */
/* ------------------------------------------------------------------ */

/** New form, blank or from a template. Opens the builder. */
export async function createForm(formData: FormData): Promise<void> {
  const s = await requireManager();
  await assertCanWrite();
  const { where, param } = formFilter(s);
  const n = await queryOne<{ n: number }>(`select count(*)::int as n from forms where ${where} and deleted_at is null`, [param]);
  if ((n?.n ?? 0) >= FORM_LIMITS.formsPerAccount) redirect("/forms?error=limit");
  const t = FORM_TEMPLATES.find((x) => x.key === formData.get("template"));
  const fields: FormField[] = t
    ? t.fields.map((f) => ({ ...f, id: newFieldId() }))
    : [
        { id: newFieldId(), type: "short_text", label: "First name", required: true, mapTo: "first_name" },
        { id: newFieldId(), type: "short_text", label: "Last name", mapTo: "last_name" },
        { id: newFieldId(), type: "email", label: "Email", mapTo: "email" },
      ];
  const settings = { ...DEFAULT_SETTINGS, intake: t?.intake ?? DEFAULT_SETTINGS.intake };
  const row = await queryOne<{ id: string }>(
    `insert into forms (user_id, org_id, name, description, code, fields, settings, template)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
    [s.userId, s.orgId, t?.name ?? "Untitled form", t?.description ?? null, newCode(), JSON.stringify(cleanDefinition(fields)), JSON.stringify(settings), t?.key ?? null],
  );
  revalidatePath("/forms");
  redirect(`/forms/${row!.id}?tab=build`);
}

export type SaveResult = { ok: true; savedAt: string } | { ok: false; error: string };

/** Saves the builder (name, description, fields, settings). Called from the browser with JSON. */
export async function saveForm(id: string, data: { name: unknown; description: unknown; fields: unknown; settings: unknown }): Promise<SaveResult> {
  const s = await formScope();
  if (!s.canManage) return { ok: false, error: "Only Admins and Managers can change forms." };
  try {
    await assertCanWrite();
  } catch {
    return { ok: false, error: "Your account is read-only right now." };
  }
  const { where, param } = formFilter(s);
  if (!isId(id)) return { ok: false, error: "That form no longer exists." };
  const name = clean(data.name, 120);
  if (!name) return { ok: false, error: "Give the form a name." };
  const description = typeof data.description === "string" ? data.description.replace(/\r\n?/g, "\n").trim().slice(0, FORM_LIMITS.descriptionLength) || null : null;
  let fields: FormField[];
  try {
    fields = cleanDefinition(data.fields, await customKinds());
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (!fields.some((f) => f.type !== "heading" && f.type !== "info")) return { ok: false, error: "Add at least one question." };
  const settings = cleanSettings(data.settings);
  settings.assignTo = await checkAssignee(s, settings.assignTo);
  const row = await queryOne<{ updated_at: string }>(
    `update forms set name = $3, description = $4, fields = $5, settings = $6, updated_at = now()
      where ${where} and id = $2 and deleted_at is null returning updated_at`,
    [param, id, name, description, JSON.stringify(fields), JSON.stringify(settings)],
  );
  if (!row) return { ok: false, error: "That form no longer exists." };
  revalidatePath("/forms");
  revalidatePath(`/forms/${id}`);
  return { ok: true, savedAt: new Date(row.updated_at).toISOString() };
}

/** Publish, pause or archive. */
export async function setFormStatus(formData: FormData): Promise<void> {
  const s = await requireManager();
  await assertCanWrite();
  const f = await ownForm(s, formData.get("id"));
  const status = formData.get("status");
  if (status !== "published" && status !== "paused" && status !== "archived" && status !== "draft") redirect(`/forms/${f.id}`);
  await query(
    `update forms set status = $2, updated_at = now(), published_at = case when $2 = 'published' then coalesce(published_at, now()) else published_at end
      where id = $1`,
    [f.id, status],
  );
  revalidatePath("/forms");
  revalidatePath(`/forms/${f.id}`);
  redirect(`/forms/${f.id}?tab=${status === "published" ? "share" : "build"}&saved=${status}`);
}

/** A new link; the old one (and its QR code) stops working right away. */
export async function newFormLink(formData: FormData): Promise<void> {
  const s = await requireManager();
  await assertCanWrite();
  const f = await ownForm(s, formData.get("id"));
  await query(`update forms set code = $2, updated_at = now() where id = $1`, [f.id, newCode()]);
  revalidatePath(`/forms/${f.id}`);
  redirect(`/forms/${f.id}?tab=share&saved=link`);
}

export async function duplicateForm(formData: FormData): Promise<void> {
  const s = await requireManager();
  await assertCanWrite();
  const f = await ownForm(s, formData.get("id"));
  const { where, param } = formFilter(s);
  const n = await queryOne<{ n: number }>(`select count(*)::int as n from forms where ${where} and deleted_at is null`, [param]);
  if ((n?.n ?? 0) >= FORM_LIMITS.formsPerAccount) redirect("/forms?error=limit");
  const row = await queryOne<{ id: string }>(
    `insert into forms (user_id, org_id, name, description, code, fields, settings, template)
     select $2, org_id, left('Copy of ' || name, 120), description, $3, fields, settings, template from forms where id = $1
     returning id`,
    [f.id, s.userId, newCode()],
  );
  revalidatePath("/forms");
  redirect(`/forms/${row!.id}?tab=build`);
}

/** Removes a form that never collected anything. Forms with submissions can only be archived. */
export async function deleteForm(formData: FormData): Promise<void> {
  const s = await requireManager();
  const f = await ownForm(s, formData.get("id"));
  const used = await queryOne(`select 1 from form_submissions where form_id = $1 limit 1`, [f.id]);
  if (used) redirect(`/forms/${f.id}?error=has-submissions`);
  await query(`update forms set deleted_at = now(), status = 'archived' where id = $1`, [f.id]);
  revalidatePath("/forms");
  redirect("/forms?saved=deleted");
}

/* ------------------------------------------------------------------ */
/* Submissions                                                         */
/* ------------------------------------------------------------------ */

type Sub = {
  id: string;
  form_id: string;
  form_name: string;
  form_user_id: string;
  form_org_id: string | null;
  status: string;
  answers: Answers;
  fields: FormField[];
  person_id: string | null;
  assigned_to: string | null;
  created_at: Date;
};

async function loadSub(s: FormScope, id: unknown): Promise<Sub> {
  const { where, param } = formFilter(s, "x.");
  const r = isId(id)
    ? await queryOne<Sub>(
        `select x.id, x.form_id, f.name as form_name, f.user_id as form_user_id, f.org_id as form_org_id, x.status, x.answers,
                x.fields, x.person_id, x.assigned_to, x.created_at
           from form_submissions x join forms f on f.id = x.form_id
          where ${where} and x.deleted_at is null and ${submissionVisibility(s, "x.")} and x.id = $3`,
        [param, s.userId, id],
      )
    : null;
  if (!r) redirect("/forms/submissions?error=gone");
  return r!;
}

const back = (id: string, q: string) => redirect(`/forms/submissions/${id}?${q}`);

/** Approve: creates a new profile from the answers. Never changes anyone who's already there. */
export async function approveSubmission(formData: FormData): Promise<void> {
  const s = await formScope();
  await assertCanWrite();
  const x = await loadSub(s, formData.get("id"));
  if (x.person_id) back(x.id, "error=done");
  const draft = profileFromAnswers(x.fields, x.answers);
  // The reviewer can fill in a missing name.
  draft.firstName = clean(formData.get("first_name"), 100) || draft.firstName;
  draft.lastName = clean(formData.get("last_name"), 100) || draft.lastName;
  if (!draft.firstName) back(x.id, "error=name");
  // The assignee if they're still active, otherwise the reviewer: always someone in this organization.
  const ownerId = (await profileOwner({ user_id: s.userId, org_id: s.orgId }, x.assigned_to)) ?? s.userId;
  const personId = await createProfile({ ownerId, orgId: s.orgId, formName: x.form_name, submittedAt: x.created_at, draft, actorId: s.userId });
  await query(`update form_submissions set status = 'approved', person_id = $2, reviewed_by = $3, reviewed_at = now() where id = $1`, [x.id, personId, s.userId]);
  revalidatePath("/forms/submissions");
  revalidatePath("/people");
  back(x.id, "saved=approved");
}

/** Already here: adds the answers as a note on an existing profile (nothing on it is overwritten). */
export async function linkSubmission(formData: FormData): Promise<void> {
  const s = await formScope();
  await assertCanWrite();
  const x = await loadSub(s, formData.get("id"));
  if (x.person_id) back(x.id, "error=done");
  const personId = formData.get("person_id");
  const person = isId(personId)
    ? await queryOne<{ id: string; user_id: string }>(
        `select id, user_id from people where id = $1 and deleted_at is null and ${s.orgId ? "org_id = $2" : "org_id is null and user_id = $2"}`,
        [personId, s.orgId ?? s.userId],
      )
    : null;
  if (!person) back(x.id, "error=match");
  const draft = profileFromAnswers(x.fields, x.answers);
  // Everything goes in the note, mapped answers included, so nothing is lost and nothing is overwritten.
  const all = profileFromAnswers(x.fields.map((f) => ({ ...f, mapTo: null })), x.answers);
  await addIntakeNote(s.userId, person!.id, intakeNote(x.form_name, x.created_at, { ...draft, noteLines: all.noteLines }));
  await query(`update form_submissions set status = 'processed', person_id = $2, reviewed_by = $3, reviewed_at = now() where id = $1`, [x.id, person!.id, s.userId]);
  revalidatePath("/forms/submissions");
  back(x.id, "saved=linked");
}

export async function setSubmissionStatus(formData: FormData): Promise<void> {
  const s = await formScope();
  await assertCanWrite();
  const x = await loadSub(s, formData.get("id"));
  const status = formData.get("status");
  if (status !== "rejected" && status !== "processed" && status !== "new" && status !== "needs_review") back(x.id, "");
  await query(`update form_submissions set status = $2, reviewed_by = $3, reviewed_at = now() where id = $1`, [x.id, status, s.userId]);
  revalidatePath("/forms/submissions");
  back(x.id, `saved=${status}`);
}

/** Admins and Managers hand a submission to a member, who then sees it and is notified. */
export async function assignSubmission(formData: FormData): Promise<void> {
  const s = await requireManager();
  await assertCanWrite();
  const x = await loadSub(s, formData.get("id"));
  const to = await checkAssignee(s, clean(formData.get("user_id"), 40) || null);
  await query(`update form_submissions set assigned_to = $2 where id = $1`, [x.id, to]);
  if (to && to !== s.userId) {
    const { notify } = await import("@/lib/notify");
    await notify(to, { type: "form_submission", title: `A response to "${x.form_name}" was assigned to you`, href: `/forms/submissions/${x.id}` });
  }
  revalidatePath("/forms/submissions");
  back(x.id, "saved=assigned");
}

/** Deletes a submission: the answers are erased for good (the row stays only as a count). */
export async function deleteSubmission(formData: FormData): Promise<void> {
  const s = await requireManager();
  const x = await loadSub(s, formData.get("id"));
  await query(`update form_submissions set deleted_at = now(), answers = '{}'::jsonb where id = $1`, [x.id]);
  revalidatePath("/forms/submissions");
  redirect("/forms/submissions?saved=deleted");
}
