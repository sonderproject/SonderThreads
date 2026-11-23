import Link from "next/link";
import { CampaignLinks } from "@/components/landing/CampaignLinks";
import { LegalLinks } from "@/components/legal/LegalPage";
import { ALL_SEO_PAGES } from "@/lib/seo-pages";
import { LANDING_LINKS, type LandingKey } from "@/lib/landing";
import { SITE_URL } from "@/lib/site";
import { MarketingAnalytics, TrackedLink } from "./Track";

/**
 * Header, footer and structured data for an audience landing page, matching the
 * homepage (app/welcome/page.tsx). The header CTA stays visible on phones.
 */
export function LandingShell({
  page,
  title,
  description,
  crumb,
  primary,
  faqs,
  children,
  after,
  wide = false,
}: {
  page: LandingKey;
  title: string;
  description: string;
  /** Breadcrumb label; omit on the homepage. */
  crumb?: string;
  primary: { href: string; label: string; short: string };
  faqs?: { q: string; a: string }[];
  children: React.ReactNode;
  /** Rendered after the page, e.g. a sticky mobile call to action. */
  after?: React.ReactNode;
  /** Full-width page: sections set their own width and background. */
  wide?: boolean;
}) {
  const path = page === "home" ? "/" : `/${page}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${SITE_URL}${path}#webpage`,
        url: `${SITE_URL}${path}`,
        name: title,
        description,
        isPartOf: { "@id": `${SITE_URL}/#website` },
        about: { "@id": `${SITE_URL}/#app` },
      },
      crumb && {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Surfdesk", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: crumb, item: `${SITE_URL}${path}` },
        ],
      },
      faqs?.length && {
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
    ].filter(Boolean),
  };

  return (
    <div className="min-h-screen bg-bg text-text">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <CampaignLinks />
      <MarketingAnalytics />
      <header className="glass pt-safe sticky top-0 z-20 border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Surfdesk home">
            <span className="brand-mark h-7 w-[37px]" aria-hidden />
            <span className="font-display text-sm font-light uppercase tracking-[0.25em] text-text">Surfdesk</span>
            <span className="hidden h-4 w-px sm:block" style={{ background: "color-mix(in srgb, var(--accent) 50%, transparent)" }} aria-hidden />
            <span className="hidden text-[11px] uppercase tracking-[0.25em] text-text-muted sm:block">by Sonder Project</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/features" className="hidden rounded-full px-4 py-2 text-sm text-text-muted transition-colors hover:text-text md:inline-block">
              Features
            </Link>
            <a href={page === "home" || page === "business" || page === "nonprofits" || page === "individuals" ? "#pricing" : "/#pricing"} className="hidden rounded-full px-4 py-2 text-sm text-text-muted transition-colors hover:text-text sm:inline-block">
              Pricing
            </a>
            <Link href="/login" className="whitespace-nowrap rounded-full px-4 py-2 text-sm text-text-muted transition-colors hover:text-text">
              Sign in
            </Link>
            <TrackedLink
              page={page}
              cta="header"
              href={primary.href}
              className="whitespace-nowrap rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-dim"
            >
              <span className="sm:hidden">{primary.short}</span>
              <span className="hidden sm:inline">{primary.label}</span>
            </TrackedLink>
          </nav>
        </div>
        <div className="nav-glow" aria-hidden />
        <div className="nav-glow-line" aria-hidden />
      </header>

      <main className={wide ? "" : "mx-auto max-w-6xl px-4 sm:px-8"}>
        {crumb && (
          <nav aria-label="Breadcrumb" className="pt-6 text-xs text-text-muted">
            <Link href="/" className="hover:text-text">
              Surfdesk
            </Link>{" "}
            / <span>{crumb}</span>
          </nav>
        )}
        {children}
      </main>

      <footer className="border-t border-border">
        <div className="pb-safe-5 mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 sm:px-8">
          <p className="text-xs text-text-muted">
            © {new Date().getFullYear()}{" "}
            <a href="https://www.sonderproject.co" className="hover:text-text hover:underline">
              Sonder Project
            </a>
          </p>
          <LegalLinks />
        </div>
        <nav aria-label="Surfdesk for" className="mx-auto flex max-w-6xl flex-wrap gap-x-5 gap-y-2 px-4 pb-8 text-xs text-text-muted sm:px-8">
          {[{ path: "/features", label: "Features" }, ...LANDING_LINKS.map((l) => ({ path: l.path, label: l.label })), ...ALL_SEO_PAGES.map((p) => ({ path: p.path, label: p.eyebrow }))].map((p) => (
            <Link key={p.path} href={p.path} className="hover:text-text">
              {p.label}
            </Link>
          ))}
        </nav>
      </footer>
      {after}
    </div>
  );
}
