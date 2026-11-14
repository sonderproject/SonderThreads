import type { Metadata } from "next";

export const metadata: Metadata = { title: "Confirm", robots: { index: false, follow: false } };

const COPY: Record<string, { title: string; body: string; button: string }> = {
  recovery: { title: "Reset your password", body: "Tap below to continue and choose a new password.", button: "Continue" },
  email_change: { title: "Confirm your new email", body: "Tap below to finish changing your sign-in email.", button: "Confirm new email" },
  invite: { title: "Accept your invite", body: "Tap below to finish setting up your account.", button: "Continue" },
};
const DEFAULT = { title: "Confirm your email", body: "One tap and you're in.", button: "Confirm my email" };

/**
 * Where email links land first. Only pressing the button uses the one-time
 * link (POST /auth/confirm), so email security scanners that open links
 * can't use it up before the person does.
 */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>;
}) {
  const { token_hash, type, next } = await searchParams;
  const copy = COPY[type ?? ""] ?? DEFAULT;
  return (
    <div className="min-h-screen bg-bg px-4 py-16 text-text">
      <main className="mx-auto max-w-sm space-y-6 text-center">
        <div className="flex items-center justify-center gap-3">
          <span className="brand-mark h-7 w-[37px]" aria-hidden />
          <span className="font-display text-sm font-light uppercase tracking-[0.25em] text-text">Surfdesk</span>
        </div>
        {token_hash && type ? (
          <form action="/auth/confirm" method="post" className="card space-y-4 p-6">
            <h1 className="page-title">{copy.title}</h1>
            <p className="text-sm text-text-muted">{copy.body}</p>
            <input type="hidden" name="token_hash" value={token_hash} />
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="next" value={next ?? "/"} />
            <button type="submit" className="w-full rounded-full bg-accent px-6 py-3 text-sm font-semibold text-bg hover:bg-accent-dim">
              {copy.button}
            </button>
          </form>
        ) : (
          <div className="card space-y-3 p-6">
            <h1 className="page-title">Link not complete</h1>
            <p className="text-sm text-text-muted">This link is missing a piece. Open it again from the email, or sign in to get a new one.</p>
            <a href="/login" className="inline-block text-sm text-accent hover:underline">
              Go to sign in
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
