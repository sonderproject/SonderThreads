import Link from "next/link";
import { SetupFrame } from "@/components/setup/SetupFrame";
import { SoloUsePicker } from "@/components/setup/SoloUsePicker";
import { saveSoloBasics } from "@/lib/actions/setup";
import { SOLO_USES, SUGGESTED_SERVICES, readDraft } from "@/lib/setup";

export const metadata = { title: "Get started · Strynd" };
export const dynamic = "force-dynamic";

type Params = { error?: string; offer?: string; utm_source?: string; utm_medium?: string; utm_campaign?: string; utm_content?: string };

/** Individual set-up, step 1 of 4: what they'll use Strynd for (and services if it's a business). */
export default async function SoloBasicsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { error, offer, ...utm } = await searchParams;
  const d = await readDraft();
  const draft = d?.flow === "solo" ? d : null;
  return (
    <SetupFrame flow="solo" step={1} title="What will you use Strynd for?" intro="So we can set it up for you. 7 days free, no card needed.">
      <form action={saveSoloBasics} className="space-y-5">
        {error === "use" && <p className="flag text-sm">Choose one to continue.</p>}
        {offer === "skip" && <input type="hidden" name="offer" value="skip" />}
        {Object.entries(utm).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v.slice(0, 80)} /> : null))}
        <SoloUsePicker uses={SOLO_USES.map((u) => ({ ...u }))} services={SUGGESTED_SERVICES.solo} initialUse={draft?.use ?? null} chosen={draft?.services ?? []} />
        <div className="flex items-center justify-between gap-3 pt-2">
          <Link href="/get-started" className="text-sm text-text-muted hover:text-text">
            ← Back
          </Link>
          <button type="submit" className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-bg hover:bg-accent-dim">
            Continue to your account
          </button>
        </div>
      </form>
    </SetupFrame>
  );
}
