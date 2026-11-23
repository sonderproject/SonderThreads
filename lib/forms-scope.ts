/** Smart-form scope filters (no server imports, so tests can use them directly). */
export type FormScope = { userId: string; orgId: string | null; canManage: boolean };

/** SQL filter on a forms/form_submissions alias; `$1` = org id or user id. */
export function formFilter(s: FormScope, alias = ""): { where: string; param: string } {
  return s.orgId ? { where: `${alias}org_id = $1`, param: s.orgId } : { where: `${alias}org_id is null and ${alias}user_id = $1`, param: s.userId };
}

/** Which submissions this person may see (always on top of formFilter). `$2` = user id. */
export function submissionVisibility(s: FormScope, alias = ""): string {
  // Managers see all; $2 is still referenced so every query can pass the same parameters.
  return s.canManage ? "($2::uuid is not null)" : `${alias}assigned_to = $2`;
}
