import Link from "next/link";
import { Turnstile } from "@/components/auth/Turnstile";
import { requestPasswordReset } from "@/app/login/actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  email: "Enter a valid email address.",
  captcha: "Please complete the security check and try again.",
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams;

  return (
    <div className="flex min-h-screen items-start justify-center bg-bg px-4 pt-32">
      <div className="w-full max-w-xs space-y-3">
        <p className="font-display text-xl font-semibold text-accent">sonderthreads</p>
        {sent ? (
          <>
            <h1 className="section-title">Check your email</h1>
            <p className="text-sm text-text-muted">
              If that email has an account, a link to set a new password is on its way. Check your spam folder if you
              don&apos;t see it within a few minutes.
            </p>
          </>
        ) : (
          <form action={requestPasswordReset} className="space-y-3">
            <h1 className="section-title">Reset your password</h1>
            <p className="text-sm text-text-muted">Enter your email and we&apos;ll send you a link to set a new password.</p>
            {error && <p className="text-xs text-danger">{ERRORS[error] ?? ERRORS.email}</p>}
            <input
              type="email"
              name="email"
              required
              autoFocus
              autoComplete="email"
              placeholder="Email"
              className="input tabular-nums"
            />
            <Turnstile />
            <button
              type="submit"
              className="w-full rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-bg hover:bg-accent-dim"
            >
              Send reset link
            </button>
          </form>
        )}
        <p className="text-center text-xs">
          <Link href="/login" className="text-text-muted hover:text-accent hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
