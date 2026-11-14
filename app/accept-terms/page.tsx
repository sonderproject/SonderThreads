import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLockup } from "@/components/BrandLockup";
import { acceptCurrentTerms, pendingAgreements } from "@/lib/actions/legal";
import { safeNextPath } from "@/lib/auth";
import { LEGAL_UPDATED } from "@/lib/legal";

export const dynamic = "force-dynamic";

/** Shown once to existing accounts whenever the Terms or Privacy policy change (lib/legal.ts). */
export default async function AcceptTermsPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next: rawNext, error } = await searchParams;
  const next = safeNextPath(rawNext);
  const pending = await pendingAgreements();
  if (!pending.user && !pending.org) redirect(next);

  const terms = (
    <Link href="/terms" target="_blank" className="text-accent hover:underline">
      Terms of service
    </Link>
  );
  const privacy = (
    <Link href="/privacy" target="_blank" className="text-accent hover:underline">
      Privacy policy
    </Link>
  );

  return (
    <div className="flex min-h-screen items-start justify-center bg-bg px-4 pt-24">
      <form action={acceptCurrentTerms} className="w-full max-w-sm space-y-4">
        <BrandLockup className="mb-2" />
        <h1 className="section-title text-text">We&apos;ve updated our terms</h1>
        <p className="text-sm text-text-muted">
          Our {terms} and {privacy} changed on {LEGAL_UPDATED}. They now spell out how plans renew and how to cancel,
          calendar sync, the front-desk kiosk, referral links and who&apos;s responsible for client information in an
          organization. Please read them and agree to keep using Surfdesk.
        </p>
        {error === "agree" && <p className="text-xs text-danger">Tick the box{pending.org ? "es" : ""} to continue.</p>}
        <input type="hidden" name="next" value={next} />
        {pending.user && (
          <label className="flex items-start gap-2 text-sm text-text">
            <input type="checkbox" name="agree" required className="mt-1" />
            <span>
              I agree to the {terms} and {privacy}.
            </span>
          </label>
        )}
        {pending.org && (
          <label className="flex items-start gap-2 text-sm text-text">
            <input type="checkbox" name="agree_org" required className="mt-1" />
            <span>
              As an admin, I agree to them for <strong>{pending.org.name}</strong>, and it has its clients&apos;
              permission (or another lawful basis) to keep their information in Surfdesk.
            </span>
          </label>
        )}
        <button type="submit" className="w-full rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg hover:bg-accent-dim">
          Agree and continue
        </button>
        <p className="text-center text-xs text-text-muted">
          Don&apos;t agree? You can export your data or delete your account in{" "}
          <Link href="/settings/data" className="text-accent hover:underline">
            Settings → Your data
          </Link>
          .
        </p>
      </form>
    </div>
  );
}
