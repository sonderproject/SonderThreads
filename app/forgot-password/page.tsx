import Link from "next/link";
import { redirect } from "next/navigation";
import { requestPasswordReset } from "@/app/login/actions";
import { emailConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  if (!emailConfigured()) redirect("/login");
  const { sent } = await searchParams;

  return (
    <div className="flex min-h-screen items-start justify-center bg-bg px-4 pt-32">
      <div className="w-full max-w-xs space-y-3">
        <p className="font-mono text-lg text-accent">&gt; sonderthreads</p>
        {sent ? (
          <p className="text-sm text-text-muted">
            If that email has an account, a reset link is on its way. It expires in 1 hour. Check your spam
            folder if you don&apos;t see it.
          </p>
        ) : (
          <form action={requestPasswordReset} className="space-y-3">
            <p className="text-sm text-text-muted">Enter your email and we&apos;ll send you a reset link.</p>
            <input
              type="email"
              name="email"
              required
              autoFocus
              autoComplete="email"
              placeholder="Email"
              className="input font-mono"
            />
            <button
              type="submit"
              className="w-full rounded bg-accent px-3 py-1.5 text-sm font-medium text-bg hover:bg-accent-dim"
            >
              Send reset link
            </button>
          </form>
        )}
        <p className="text-center text-xs text-text-muted">
          <Link href="/login" className="text-accent hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
