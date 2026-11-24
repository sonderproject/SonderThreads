import Link from "next/link";
import { BUSINESS_FEATURES } from "@/lib/plan";
import { SEAT_CENTS } from "@/lib/pricing";

/** Settings, individuals only: what a Business account adds, and how to start one. */
export function UpgradeCard() {
  return (
    <section className="card space-y-3 p-4" aria-labelledby="grow">
      <div className="space-y-1">
        <p className="eyebrow text-text-faint">Business</p>
        <h2 id="grow" className="text-base font-semibold text-text">
          Grow into Business
        </h2>
        <p className="text-sm text-text-muted">For ${SEAT_CENTS / 100} a month, even if it&apos;s just you. Everything you have now, plus:</p>
      </div>
      <ul className="space-y-1.5 text-sm text-text">
        {BUSINESS_FEATURES.map((f) => (
          <li key={f} className="flex gap-2">
            <span className="text-accent" aria-hidden>
              ✓
            </span>
            {f}
          </li>
        ))}
      </ul>
      <Link href="/organization/new?kind=business" className="inline-block rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg hover:bg-accent-dim">
        Set up my business
      </Link>
    </section>
  );
}
