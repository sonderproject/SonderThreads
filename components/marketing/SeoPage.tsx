import Link from "next/link";
import type { Metadata } from "next";
import { BrandLockup } from "@/components/BrandLockup";
import { LegalLinks } from "@/components/legal/LegalPage";
import { ALL_SEO_PAGES, COMPARE_NOTE, type SeoPageData } from "@/lib/seo-pages";
import { SITE_URL } from "@/lib/site";
import { LANDING_LINKS } from "@/lib/landing";
import { MarketingAnalytics } from "@/components/marketing/landing/Track";

const SIGNUP: Record<SeoPageData["cta"], string> = {
  solo: "/get-started/solo",
  team: "/get-started/org",
  any: "/get-started",
};

/** Metadata for a public SEO page. */
export function seoMetadata(page: SeoPageData, path: string): Metadata {
  return {
    title: { absolute: page.title },
    description: page.description,
    alternates: { canonical: path },
    openGraph: { title: page.title, description: page.description, url: path, siteName: "Surfdesk", type: "website" },
    twitter: { card: "summary_large_image", title: page.title, description: page.description },
  };
}

function Marker({ children }: { children: React.ReactNode }) {
  return <p className="section-label">{children}</p>;
}

/** Shared layout for /for, /compare and /templates pages. */
export function SeoPage({ page, path }: { page: SeoPageData; path: string }) {
  const signup = SIGNUP[page.cta];
  const accent = page.h1Accent && page.h1.endsWith(page.h1Accent) ? page.h1Accent : "";
  const h1Lead = accent ? page.h1.slice(0, -accent.length) : page.h1;
  const related = [
    { path: "/features", eyebrow: "All features" },
    ...LANDING_LINKS.map((l) => ({ path: l.path, eyebrow: l.label })),
    ...ALL_SEO_PAGES.filter((p) => p.path !== path).slice(0, 5),
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${SITE_URL}${path}#webpage`,
        url: `${SITE_URL}${path}`,
        name: page.title,
        description: page.description,
        isPartOf: { "@id": `${SITE_URL}/#website` },
        about: { "@id": `${SITE_URL}/#app` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Surfdesk", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: page.eyebrow, item: `${SITE_URL}${path}` },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: page.faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return (
    <div className="min-h-screen bg-bg text-text">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <MarketingAnalytics />
      <header className="glass pt-safe sticky top-0 z-20 border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <BrandLockup />
          <nav className="flex items-center gap-2">
            <Link href="/#pricing" className="hidden rounded-full px-4 py-2 text-sm text-text-muted hover:text-text sm:inline-block">
              Pricing
            </Link>
            <Link href="/login" className="rounded-full px-4 py-2 text-sm text-text-muted hover:text-text">
              Sign in
            </Link>
            <Link href={signup} className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg hover:bg-accent-dim">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-8">
        <nav aria-label="Breadcrumb" className="pt-6 text-xs text-text-muted">
          <Link href="/" className="hover:text-text">
            Surfdesk
          </Link>{" "}
          / <span>{page.eyebrow}</span>
        </nav>

        <section className="space-y-6 py-12 sm:py-16">
          <Marker>{page.eyebrow}</Marker>
          <h1 className="max-w-3xl font-display text-4xl font-light leading-[1.05] tracking-[-0.02em] sm:text-5xl">
            {h1Lead}
            {accent && <span className="text-accent">{accent}</span>}
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-text-muted sm:text-lg">{page.lede}</p>
          {page.download ? (
            <div className="flex flex-wrap gap-3">
              <a href={page.download.href} download className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-bg hover:bg-accent-dim">
                {page.download.label}
              </a>
              <Link href={signup} className="rounded-full border border-border bg-bg-raised px-6 py-3 text-sm font-semibold hover:bg-bg-hover">
                Or try Surfdesk free
              </Link>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              <Link href={signup} className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-bg hover:bg-accent-dim">
                Start your free trial
              </Link>
              <Link href="/#pricing" className="rounded-full border border-border bg-bg-raised px-6 py-3 text-sm font-semibold hover:bg-bg-hover">
                See pricing
              </Link>
            </div>
          )}
        </section>

        {page.download && (
          <section className="card space-y-3 p-6">
            <h2 className="font-display text-xl font-normal">What&apos;s in the template</h2>
            <ul className="grid gap-2 text-sm text-text-muted sm:grid-cols-2">
              {page.download.what.map((w) => (
                <li key={w} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                  {w}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-6 border-t border-border py-12">
          <h2 className="font-display text-2xl font-light tracking-[-0.01em] sm:text-3xl">{page.painTitle}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {page.pains.map((p) => (
              <li key={p} className="card p-4 text-sm leading-relaxed text-text-muted">
                {p}
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-6 border-t border-border py-12">
          <h2 className="font-display text-2xl font-light tracking-[-0.01em] sm:text-3xl">{page.featuresTitle}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {page.features.map((f) => (
              <div key={f.title} className="card space-y-1.5 p-5">
                <h3 className="font-display text-lg font-normal">{f.title}</h3>
                <p className="text-sm leading-relaxed text-text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {page.table && (
          <section className="space-y-4 border-t border-border py-12">
            <h2 className="font-display text-2xl font-light tracking-[-0.01em] sm:text-3xl">Side by side</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-text-muted">
                    <th className="py-3 pr-4 font-medium"> </th>
                    <th className="py-3 pr-4 font-semibold text-accent">Surfdesk</th>
                    <th className="py-3 font-medium">{page.table.other}</th>
                  </tr>
                </thead>
                <tbody>
                  {page.table.rows.map(([row, us, them]) => (
                    <tr key={row} className="border-b border-border-subtle">
                      <th scope="row" className="py-3 pr-4 font-medium">
                        {row}
                      </th>
                      <td className="py-3 pr-4">{us}</td>
                      <td className="py-3 text-text-muted">{them}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-text-muted">{COMPARE_NOTE}</p>
          </section>
        )}

        <section className="space-y-4 border-t border-border py-12">
          <h2 className="font-display text-2xl font-light tracking-[-0.01em] sm:text-3xl">Questions</h2>
          <div className="space-y-3">
            {page.faqs.map((f) => (
              <details key={f.q} className="card p-5">
                <summary className="cursor-pointer font-semibold">{f.q}</summary>
                <p className="mt-3 text-sm leading-relaxed text-text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="space-y-5 border-t border-border py-16 text-center">
          <h2 className="font-display text-3xl font-light tracking-[-0.02em]">
            Every client. Every follow-up. <span className="text-accent">Nothing slips.</span>
          </h2>
          <p className="text-sm text-text-muted">7-day free trial for individuals, 14 days for teams. Skip the trial and get 30% off your first month.</p>
          <Link href={signup} className="inline-block rounded-full bg-accent px-6 py-3 text-sm font-semibold text-bg hover:bg-accent-dim">
            Start your free trial
          </Link>
        </section>

        <section className="space-y-3 border-t border-border py-10">
          <p className="section-label">More from Surfdesk</p>
          <ul className="flex flex-wrap gap-2">
            {related.map((r) => (
              <li key={r.path}>
                <Link href={r.path} className="inline-block rounded-full border border-border px-3 py-1.5 text-xs text-text-muted hover:text-text">
                  {r.eyebrow}
                </Link>
              </li>
            ))}
          </ul>
        </section>
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
      </footer>
    </div>
  );
}
