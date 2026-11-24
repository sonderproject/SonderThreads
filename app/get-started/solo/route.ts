import { randomUUID } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { logEvent } from "@/lib/events";
import { readDraft, signupHref, writeDraft, type SoloDraft } from "@/lib/setup";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"];

/**
 * "Just me": no questions before the account (Nov 24, 2026). Starts the individual set-up
 * in this browser (campaign tags, the skip-the-trial offer) and goes straight to sign-up.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const prev = await readDraft();
  const base: SoloDraft = prev?.flow === "solo" ? prev : { flow: "solo" };
  const utm: Record<string, string> = {};
  for (const k of UTM_KEYS) {
    const v = params.get(k)?.trim();
    if (v) utm[k] = v.slice(0, 80);
  }
  const draft: SoloDraft = {
    ...base,
    offer: params.get("offer") === "skip" || base.offer,
    utm: Object.keys(utm).length ? utm : base.utm,
    fid: base.fid ?? randomUUID(),
  };
  // One row per browser for the owner's sign-up drop-off view.
  if (!draft.seen?.includes("funnel.solo.basics")) {
    draft.seen = [...(draft.seen ?? []), "funnel.solo.basics"];
    await logEvent("funnel.solo.basics", "Set-up step", { meta: { fid: draft.fid ?? null } }).catch(() => undefined);
  }
  await writeDraft(draft);
  return NextResponse.redirect(new URL(signupHref("solo", draft.utm), request.url));
}
