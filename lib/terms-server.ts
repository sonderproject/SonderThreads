import { getMembership } from "@/lib/org";
import { termsFor, type Terms } from "@/lib/terms";

/** The signed-in person's words: organization terms for active members, plain ones otherwise. */
export async function getTerms(): Promise<Terms> {
  const m = await getMembership().catch(() => null);
  return termsFor(Boolean(m?.active));
}
