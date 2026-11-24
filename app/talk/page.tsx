import type { Metadata } from "next";
import Link from "next/link";
import { BrandLockup } from "@/components/BrandLockup";
import { SubmitButton } from "@/components/setup/SubmitButton";
import { requestTalk } from "@/lib/actions/talk";
import { TALK_SIZES } from "@/lib/talk";

export const metadata: Metadata = {
  title: "Talk to us · Surfdesk",
  description: "Set up a short call to see how Surfdesk fits your organization: a walkthrough with your own workflow, setup help and pricing for your team.",
  alternates: { canonical: "/talk" },
};
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  name: "Enter your name.",
  email: "Enter a valid email address.",
  org: "Enter your organization's name.",
  rate: "We already have a few requests from this network. We'll be in touch, or email us directly.",
};

const ON_THE_CALL = [
  "A walkthrough using your own day-to-day work, not a canned demo",
  "How your team, clients and reports would be set up",
  "Pricing for your team size, and help moving your data in",
];

/** "Talk to us": organizations ask for a call. Requests land in the owner Inbox and support email (lib/actions/talk.ts). */
export default async function TalkPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string; from?: string }> }) {
  const { sent, error, from } = await searchParams;
  const source = (from ?? "talk").replace(/[^a-z-]/g, "").slice(0, 20) || "talk";

  return (
    <div className="flex min-h-screen items-start justify-center bg-bg px-4 pb-16 pt-16 sm:pt-24">
      <div className="w-full max-w-lg space-y-6">
        <BrandLockup />
        {sent ? (
          <div className="space-y-3">
            <h1 className="page-title">Thanks. We&apos;ll be in touch.</h1>
            <p className="text-sm text-text-muted">
              We&apos;ll email you to find a time that works. Want to look around first? You can start a free trial today; anything you set up
              carries over.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/get-started/org" className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-bg hover:bg-accent-dim">
                Start a free team trial
              </Link>
              <Link href="/" className="rounded-full border border-border px-5 py-2 text-sm font-medium text-text hover:bg-bg-hover">
                Back to the homepage
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <p className="eyebrow text-text-faint">For organizations</p>
              <h1 className="page-title">Talk to us</h1>
              <p className="text-sm text-text-muted">Tell us a little about your organization and we&apos;ll set up a short call.</p>
            </div>
            <ul className="space-y-1.5 text-sm text-text">
              {ON_THE_CALL.map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="text-accent" aria-hidden>
                    ✓
                  </span>
                  {t}
                </li>
              ))}
            </ul>
            <form action={requestTalk} className="space-y-4">
              {error && (
                <p role="alert" className="flag text-sm">
                  {ERRORS[error] ?? "Something went wrong. Please try again."}
                </p>
              )}
              <input type="hidden" name="from" value={source} />
              {/* Honeypot: hidden from people, filled in by bots. */}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-text">Your name</span>
                  <input name="name" required maxLength={120} autoComplete="name" className="input" />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-text">Work email</span>
                  <input name="email" type="email" required maxLength={254} autoComplete="email" className="input" />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-text">Organization</span>
                  <input name="org" required maxLength={200} autoComplete="organization" className="input" />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-text">
                    Your role <span className="font-normal text-text-muted">(optional)</span>
                  </span>
                  <input name="role" maxLength={120} autoComplete="organization-title" placeholder="Executive Director, Owner…" className="input" />
                </label>
              </div>
              <fieldset className="space-y-2">
                <legend className="mb-1 text-sm font-medium text-text">
                  How many people would use it? <span className="font-normal text-text-muted">(optional)</span>
                </legend>
                <div className="flex flex-wrap gap-2">
                  {TALK_SIZES.map((s) => (
                    <label
                      key={s}
                      className="cursor-pointer rounded-full border border-border px-3 py-1.5 text-sm text-text transition-colors hover:bg-bg-hover has-[:checked]:border-accent has-[:checked]:bg-accent has-[:checked]:text-bg has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent"
                    >
                      <input type="radio" name="size" value={s} className="sr-only" />
                      {s}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-text">
                  Anything we should know? <span className="font-normal text-text-muted">(optional)</span>
                </span>
                <textarea
                  name="message"
                  rows={3}
                  maxLength={3000}
                  placeholder="What you use today, what's not working, good times to talk…"
                  className="input"
                />
              </label>
              <p className="text-xs text-text-muted">
                We only use this to reply to you. See our{" "}
                <Link href="/privacy" target="_blank" className="text-accent hover:underline">
                  Privacy policy
                </Link>
                .
              </p>
              <SubmitButton pendingLabel="Sending…" className="w-full rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-bg hover:bg-accent-dim">
                Request a call
              </SubmitButton>
            </form>
            <p className="text-center text-xs text-text-muted">
              Rather jump in?{" "}
              <Link href="/get-started" className="text-accent hover:underline">
                Start a free trial
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
