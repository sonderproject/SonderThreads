import type { Metadata } from "next";
import Link from "next/link";
import { SITE_DESCRIPTION } from "@/lib/site";

// Signed-out visitors to "/" are shown this page (middleware rewrites to it),
// so "/" is the canonical address search engines should index.
export const metadata: Metadata = {
  title: "sonderthreads: lists, notes and dates in one place",
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: "sonderthreads",
    description: SITE_DESCRIPTION,
    url: "/",
    siteName: "sonderthreads",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "sonderthreads", description: SITE_DESCRIPTION },
};

const EXAMPLES = [
  { input: "add milk, eggs and coffee to groceries", result: "3 items added to groceries" },
  { input: "note: spare key is with the neighbor", result: "note saved" },
  { input: "remind me to renew my license oct 15", result: "task · thu, oct 15" },
];

const COMMANDS = [
  ["lists", "groceries, packing, projects. check off, reorder, share, export."],
  ["notes", "jot it down fast. search everything."],
  ["dates", "tasks, reminders, repeats. one calendar."],
  ["people", "notes and birthdays for the people in your life."],
];

function AuthButtons() {
  return (
    <div className="flex flex-wrap gap-3">
      <Link
        href="/signup"
        className="rounded bg-accent px-6 py-3 text-xl text-bg transition-colors hover:bg-accent-dim sm:text-2xl"
      >
        &gt; sign up
      </Link>
      <Link
        href="/login"
        className="rounded border-2 border-accent px-6 py-3 text-xl text-accent transition-colors hover:bg-accent hover:text-bg sm:text-2xl"
      >
        &gt; sign in
      </Link>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <div className="pt-safe min-h-screen bg-bg font-mono text-lg leading-relaxed text-text sm:text-xl">
      {/* Phones: one column. Computers (lg+): two columns that fit on one screen without scrolling. */}
      <div className="mx-auto flex max-w-2xl flex-col gap-10 px-4 py-10 sm:py-16 lg:min-h-screen lg:max-w-6xl lg:gap-0 lg:px-10 lg:py-8">
        <header className="flex items-center justify-between gap-3 whitespace-nowrap text-base sm:text-xl">
          <span className="text-accent">&gt; sonderthreads</span>
          <nav className="flex gap-2">
            <Link
              href="/login"
              className="rounded border border-accent px-3 py-1 text-accent transition-colors hover:bg-accent hover:text-bg"
            >
              sign in
            </Link>
            <Link href="/signup" className="rounded bg-accent px-3 py-1 text-bg transition-colors hover:bg-accent-dim">
              sign up
            </Link>
          </nav>
        </header>

        <div className="flex flex-col gap-10 lg:my-auto lg:gap-10 lg:py-4">
          <div className="flex flex-col gap-10 lg:grid lg:grid-cols-2 lg:items-center lg:gap-16">
            <div className="flex flex-col gap-10 lg:gap-8">
              <section className="space-y-1">
                <p className="text-text-faint">$ sonderthreads --about</p>
                <h1 className="text-text lg:text-3xl">lists, notes and dates. one place.</h1>
                <p className="text-text-muted">type it or say it. it files itself.</p>
              </section>

              <div className="space-y-3">
                <AuthButtons />
                <p className="text-text-faint">free. browser and phone.</p>
              </div>
            </div>

            <section className="space-y-3">
              {EXAMPLES.map((ex) => (
                <div key={ex.input}>
                  <p>
                    <span className="text-accent">&gt; </span>
                    {ex.input}
                  </p>
                  <p className="text-text-muted">  ✓ {ex.result}</p>
                </div>
              ))}
            </section>
          </div>

          <section className="space-y-1">
            <p className="text-text-faint">$ sonderthreads --help</p>
            <dl className="space-y-1 lg:grid lg:grid-cols-2 lg:gap-x-16 lg:gap-y-1 lg:space-y-0">
              {COMMANDS.map(([cmd, desc]) => (
                <div key={cmd} className="grid grid-cols-[5.5rem_1fr] gap-2 sm:grid-cols-[7rem_1fr]">
                  <dt className="text-accent">{cmd}</dt>
                  <dd className="text-text-muted">{desc}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
