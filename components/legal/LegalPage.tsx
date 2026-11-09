import Link from "next/link";

/** Shared frame for the public legal pages (privacy, terms, account deletion). */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-[760px] space-y-8 px-4 py-8 sm:py-12">
        <header className="flex items-center justify-between gap-3 text-sm">
          <Link href="/" className="font-display text-lg font-semibold text-accent">
            sonderthreads
          </Link>
          <nav className="flex gap-3 text-text-muted">
            <Link href="/privacy" className="hover:text-accent">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-accent">
              Terms
            </Link>
          </nav>
        </header>
        <div className="space-y-1">
          <h1 className="page-title">{title}</h1>
          <p className="text-sm text-text-muted">Last updated {updated}</p>
        </div>
        <article className="legal space-y-6 text-[0.95rem] leading-relaxed text-text">{children}</article>
        <footer className="border-t border-border pt-4 text-xs text-text-muted">
          Questions? Email{" "}
          <a href="mailto:dante@sonderproject.co" className="text-accent hover:underline">
            dante@sonderproject.co
          </a>
          .
        </footer>
      </div>
    </div>
  );
}

/** A titled section of a legal page. */
export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-[1.3rem] font-semibold text-text">{title}</h2>
      {children}
    </section>
  );
}

/** The public footer links (landing, sign-up). */
export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <nav className={`flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted ${className}`}>
      <Link href="/privacy" className="hover:text-accent">
        Privacy policy
      </Link>
      <Link href="/terms" className="hover:text-accent">
        Terms of service
      </Link>
      <Link href="/account-deletion" className="hover:text-accent">
        Delete your account
      </Link>
    </nav>
  );
}
