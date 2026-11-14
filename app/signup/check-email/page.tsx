import Link from "next/link";
import { BrandLockup } from "@/components/BrandLockup";
import { Turnstile } from "@/components/auth/Turnstile";
import { resendConfirmation, verifySignupCode } from "@/app/login/actions";
import { SetupProgress } from "@/components/setup/SetupFrame";
import { CodeInput } from "@/components/setup/CodeInput";
import { setupFlowFor } from "@/lib/setup";

export const dynamic = "force-dynamic";

/**
 * After sign-up (or signing in before confirming): the account can't be used
 * until the emailed link is opened. Offers to send the email again.
 */
export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; resent?: string; error?: string; next?: string }>;
}) {
  const { email, resent, error, next } = await searchParams;
  const flow = setupFlowFor(next);
  return (
    <div className={`flex min-h-screen items-start justify-center bg-bg px-4 ${flow ? "pb-16 pt-16 sm:pt-24" : "pt-32"}`}>
      <div className={`w-full space-y-3 ${flow ? "max-w-sm" : "max-w-xs"}`}>
        {flow ? <div className="mb-4"><SetupProgress flow={flow} step={flow === "org" ? 4 : 3} /></div> : <BrandLockup className="mb-2" />}
        <h1 className={flow ? "page-title" : "section-title"}>Check your email</h1>
        <p className="text-sm text-text-muted">
          We sent an email to {email ? <strong className="text-text">{email}</strong> : "your email"}. Tap{" "}
          <strong className="text-text">Confirm</strong> in it, or type the 6-digit code from it here.
        </p>
        <form action={verifySignupCode} className="space-y-2 card p-3">
          <input type="hidden" name="next" value={next ?? "/"} />
          {!email && (
            <input type="email" name="email" required autoComplete="email" placeholder="Email" className="input tabular-nums" />
          )}
          {email && <input type="hidden" name="email" value={email} />}
          <CodeInput />
          {error === "code" && <p role="alert" className="text-xs text-danger">That code didn&apos;t work. Check it and try again, or use the newest email.</p>}
          {error === "code-expired" && <p role="alert" className="text-xs text-danger">That code has expired. Send a new email below.</p>}
          <button type="submit" className="w-full rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-bg hover:bg-accent-dim">
            Confirm with code
          </button>
        </form>
        <p className="text-xs text-text-muted">It can take a minute. Check your spam folder if you don&apos;t see it.</p>

        {resent && <p className="text-xs text-accent">Sent again. Use the newest email.</p>}
        {error === "rate" && <p className="text-xs text-danger">Please wait a minute before sending another.</p>}
        {error === "captcha" && <p className="text-xs text-danger">Please complete the security check and try again.</p>}

        <form action={resendConfirmation} className="space-y-2 card p-3">
          <input type="hidden" name="next" value={next ?? "/"} />
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
