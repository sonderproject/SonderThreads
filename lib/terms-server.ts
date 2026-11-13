import { getMembership } from "@/lib/org";
import { termsFor, type Audience, type Terms } from "@/lib/terms";

/** Which words the signed-in person sees: their organization's type, or "individual" outside one. */
export async function getAudience(): Promise<Audience> {
  const m = await getMembership().catch(() => null);
  return m?.active ? m.orgKind : "individual";
}

export async function getTerms(): Promise<Terms> {
  return termsFor(await getAudience());
}
