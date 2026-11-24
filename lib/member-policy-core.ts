import { queryOne } from "@/lib/db/client";

/**
 * What an organization lets its Members (role case_manager) do with data.
 * Admins choose on the Organization page; both are OFF by default (owner's
 * decision, Nov 24, 2026): a Member's login belongs to the organization, so
 * they can't download data or keep private contacts unless an Admin allows it.
 * Admins, Managers and solo accounts are never limited by this.
 */
export type MemberPolicy = {
  /** True when this person is an active Member of an organization (the switches apply to them). */
  managed: boolean;
  /** Download exports: full backup, client and visit spreadsheets, group-list exports. */
  canExport: boolean;
  /** Add a client with "Keep private" (owner-only, never joins the organization). */
  canKeepPrivate: boolean;
};

export async function memberPolicyFor(userId: string): Promise<MemberPolicy> {
  const row = await queryOne<{ role: string; can_export: boolean; can_private: boolean }>(
    `select m.role, o.members_can_export as can_export, o.members_can_keep_private as can_private
       from memberships m join organizations o on o.id = m.org_id
      where m.user_id = $1 and m.active
      limit 1`,
    [userId],
  );
  if (!row || row.role !== "case_manager") return { managed: false, canExport: true, canKeepPrivate: true };
  return { managed: true, canExport: row.can_export, canKeepPrivate: row.can_private };
}

/** Shown where a blocked download or option would be. */
export const MANAGED_DATA_MESSAGE =
  "Your organization manages its data, so downloads are turned off for Members. Ask an Admin if you need a copy.";
