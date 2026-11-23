"use client";

import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import { track } from "@vercel/analytics";

/** Public marketing pages. Anything else (the app, sign-in, sign-up) is never sent, even if the script stays loaded. */
const MARKETING = /^\/(?:$|welcome$|individuals$|business$|nonprofits$|features$|(?:for|compare|templates)\/[a-z0-9-]+$)/;

/**
 * Vercel Web Analytics for public marketing pages only (never mounted inside the app,
 * so no client records or account pages are ever sent). Query strings are trimmed to
 * campaign tags before anything leaves the browser. No cookies.
 */
export function MarketingAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => {
        try {
          const url = new URL(event.url);
          if (!MARKETING.test(url.pathname.replace(/\/$/, "") || "/")) return null;
          for (const key of [...url.searchParams.keys()]) if (!key.startsWith("utm_")) url.searchParams.delete(key);
          return { ...event, url: url.toString() };
        } catch {
          return null;
        }
      }}
    />
  );
}

/**
 * A call-to-action link that records which page and button was clicked.
 * Sign-up links are recorded as "Signup Start", demo requests as "Demo Request",
 * everything else as "CTA Click". Only the page and button names are sent.
 */
export function TrackedLink({
  page,
  cta,
  href,
  className,
  children,
}: {
  page: string;
  cta: string;
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const event = href.startsWith("/get-started") ? "Signup Start" : cta.startsWith("demo") ? "Demo Request" : "CTA Click";
  const onClick = () => track(event, { page, cta });
  if (href.startsWith("/") && !href.startsWith("//")) {
    return (
      <Link href={href} className={className} onClick={onClick}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  );
}
