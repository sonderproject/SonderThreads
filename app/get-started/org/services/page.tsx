import { redirect } from "next/navigation";
import { readDraft, signupHref } from "@/lib/setup";

export const dynamic = "force-dynamic";

/**
 * The old step 2 (services). Services now come from the line of work picked on
 * step 1, so links and bookmarks here continue to the account step.
 */
export default async function OrgServicesPage() {
  const d = await readDraft();
  if (d?.flow !== "org" || !d.name || !d.kind) redirect("/get-started/org");
  redirect(signupHref("org", d.utm));
}
