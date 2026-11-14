import Link from "next/link";
import { redirect } from "next/navigation";
import { SetupFrame } from "@/components/setup/SetupFrame";
import { ServicePicker } from "@/components/setup/ServicePicker";
import { saveOrgServices } from "@/lib/actions/setup";
import { SUGGESTED_SERVICES, readDraft } from "@/lib/setup";

export const metadata = { title: "Your services · Strynd" };
export const dynamic = "force-dynamic";

/** Organization set-up, step 2 of 7: what they offer (optional), and the organization agreement. */
export default async function OrgServicesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const d = await readDraft();
  if (d?.flow !== "org" || !d.name || !d.kind) redirect("/get-started/org");
  const business = d.kind === "business";
  return (
    <SetupFrame
      flow="org"
      step={2}
      title={`What does ${d.name} offer?`}
      intro={
        business
          ? "Pick what your staff log when a customer comes in. Add prices to see revenue in your Insights reports. Optional; you can change these any time in Settings → Services."
          : "Pick the services your staff log when they meet with a client; your Impact report counts each one. Optional; you can change these any time in Settings → Services."
      }
    >
      <form action={saveOrgServices} className="space-y-5">
        {error === "agree" && <p className="flag text-sm">Please confirm the agreement below to continue.</p>}
        <ServicePicker suggestions={SUGGESTED_SERVICES[d.kind]} withPrices={business} chosen={d.services ?? []} />

        <label className="flex items-start gap-2 text-xs text-text-muted">
          <input type="checkbox" name="agree" required defaultChecked={d.agreed} className="mt-0.5" />
          <span>
            I&apos;m authorized to agree to the{" "}
            <Link href="/terms" target="_blank" className="text-accent hover:underline">
              Terms of service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" target="_blank" className="text-accent hover:underline">
              Privacy policy
            </Link>{" "}
            for this organization, and it has its clients&apos; permission (or another lawful basis) to keep their information in Strynd.
          </span>
        </label>

        <div className="flex items-center justify-between gap-3 pt-2">
          <Link href="/get-started/org" className="text-sm text-text-muted hover:text-text">
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
