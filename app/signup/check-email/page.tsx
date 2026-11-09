import Link from "next/link";
import { BrandLockup } from "@/components/BrandLockup";
import { Turnstile } from "@/components/auth/Turnstile";
import { resendConfirmation } from "@/app/login/actions";

export const dynamic = "force-dynamic";

/**
 * After sign-up (or signing in before confirming): the account can't be used
 * until the emailed link is opened. Offers to send the email again.
 */
export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; resent?: string; error?: string }>;
}) {
  const { email, resent, error } = await searchParams;
  return (
    <div className="flex min-h-screen items-start justify-center bg-bg px-4 pt-32">
      <div className="w-full max-w-xs space-y-3">
        <BrandLockup className="mb-2" />
        <h1 className="section-title">Check your email</h1>
        <p className="text-sm text-text-muted">
          We sent a confirmation link to {email ? <strong className="text-text">{email}</strong> : "your email"}. Open it
          to finish setting up your account. You can&apos;t sign in until it&apos;s confirmed.
        </p>
        <p className="text-xs text-text-muted">It can take a minute. Check your spam folder if you don&apos;t see it.</p>

        {resent && <p className="text-xs text-accent">Sent again. Use the newest email.</p>}
        {error === "rate" && <p className="text-xs text-danger">Please wait a minute before sending another.</p>}
        {error === "captcha" && <p className="text-xs text-danger">Please complete the security check and try again.</p>}

        <form action={resendConfirmation} className="space-y-2 card p-3">
          <p className="text-xs text-text-muted">Didn&apos;t get it?</p>
          <input
            type="email"
            name="email"
            required
            defaultValue={email ?? ""}
            autoComplete="email"
            placeholder="Email"
            className="input tabular-nums"
          />
          <Turnstile />
          <button
            type="submit"
            className="w-full rounded-full border border-border bg-bg-raised px-3 py-1.5 text-sm font-medium text-text hover:bg-bg-hover"
          >
            Resend confirmation email
          </button>
        </form>

        <p className="text-center text-xs">
          <Link href="/login" className="text-accent hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
