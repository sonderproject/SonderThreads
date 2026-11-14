import Link from "next/link";
import { BrandLockup } from "@/components/BrandLockup";

export const metadata = { title: "Get started · Surfdesk" };

type Params = { offer?: string; utm_source?: string; utm_medium?: string; utm_campaign?: string; utm_content?: string };

/** "Get started": who it's for. Each choice opens its own guided set-up. */
export default async function GetStartedPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string" && v) as [string, string][]).toString();
  const withQs = (path: string) => (qs ? `${path}?${qs}` : path);
  const choices = [
    {
      href: withQs("/get-started/solo"),
      title: "Just me",
      body: "For yourself or your own small business. 7 days free, no card needed.",
    },
    {
      href: withQs("/get-started/org"),
      title: "My team or organization",
      body: "Nonprofits, agencies and businesses with staff. Shared clients, roles, reports. 14 days free.",
    },
  ];
  return (
    <div className="flex min-h-screen items-start justify-center bg-bg px-4 pb-16 pt-16 sm:pt-24">
      <div className="w-full max-w-lg space-y-6">
        <BrandLockup />
        <div className="space-y-1">
          <h1 className="page-title">Who is Surfdesk for?</h1>
          <p className="text-sm text-text-muted">A couple of quick questions sets the app up the way you work.</p>
        </div>
        <div className="grid gap-3">
          {choices.map((c) => (
            <Link key={c.title} href={c.href} className="card block space-y-1 p-5 transition-colors hover:bg-bg-hover">
              <span className="flex items-center justify-between gap-2">
                <span className="text-lg font-semibold text-text">{c.title}</span>
                <span className="text-accent" aria-hidden>
                  →
                </span>
              </span>
              <span className="block text-sm text-text-muted">{c.body}</span>
            </Link>
          ))}
        </div>
        <p className="text-center text-xs text-text-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
