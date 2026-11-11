import Link from "next/link";

/** Sonder Project mark + "Strynd", Sonder Studio style. Links home. */
export function BrandLockup({ className = "" }: { className?: string }) {
  return (
    <Link href="/" aria-label="Strynd home" className={`inline-flex items-center gap-3 ${className}`}>
      <span className="brand-mark h-7 w-[37px]" aria-hidden />
      <span className="font-display text-sm font-light uppercase tracking-[0.25em] text-text">Strynd</span>
    </Link>
  );
}
