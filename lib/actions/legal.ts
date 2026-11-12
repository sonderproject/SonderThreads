"use server";

import { redirect } from "next/navigation";
import { queryOne } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { safeNextPath } from "@/lib/auth";
import { LEGAL_VERSION } from "@/lib/legal";
import { recordAcceptance } from "@/lib/legal-server";

/** What the signed-in person still needs to agree to: for themselves, and (admins) for their organization. */
export async function pendingAgreements(): Promise<{ user: boolean; org: { id: string; name: string } | null }> {
  const userId = await requireUserId();
  const row = await queryOne<{ terms_version: string | null; org_id: string | null; org_name: string | null; org_version: string | null }>(
    `select u.terms_version, o.id as org_id, o.name as org_name, o.terms_version as org_version
       from users u
       left join memberships m on m.user_id = u.id and m.active and m.role = 'admin'
       left join organizations o on o.id = m.org_id
      where u.id = $1`,
    [userId],
  );
  return {
    user: row?.terms_version !== LEGAL_VERSION,
    org: row?.org_id && row.org_version !== LEGAL_VERSION ? { id: row.org_id, name: row.org_name ?? "your organization" } : null,
  };
}

/** The "We've updated our terms" screen's button. */
export async function acceptCurrentTerms(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const next = safeNextPath(formData.get("next")?.toString());
  const pending = await pendingAgreements();
  const back = () => redirect(`/accept-terms?error=agree&next=${encodeURIComponent(next)}`);
  if (pending.user && formData.get("agree") !== "on") back();
  if (pending.org && formData.get("agree_org") !== "on") back();
  if (pending.user) await recordAcceptance(userId, "user");
  if (pending.org) await recordAcceptance(userId, "organization", pending.org.id);
  redirect(next);
}
