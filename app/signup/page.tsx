import Link from "next/link";
import { legacyDataUnclaimed, signup } from "@/app/login/actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  email: "Enter a valid email address.",
  short: "Password must be at least 8 characters.",
  exists: "An account with that email already exists.",
  legacy: "That isn't the current shared password.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; email?: string; deleted?: string }>;
}) {
  const { error, next, email, deleted } = await searchParams;
  const showLegacy = await legacyDataUnclaimed();
  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";

  return (
    <div className="flex min-h-screen items-start justify-center bg-bg px-4 pt-32">
      <form action={signup} className="w-full max-w-xs space-y-3">
        <p className="font-mono text-lg text-accent">&gt; sonderthreads</p>
        {deleted && <p className="text-xs text-text-muted">Your account and data were deleted.</p>}
        {error && <p className="text-xs text-danger">{ERRORS[error] ?? "Something went wrong."}</p>}
        <input type="hidden" name="next" value={next ?? ""} />
        <input
          type="email"
          name="email"
          required
          autoFocus
          defaultValue={email ?? ""}
          autoComplete="email"
          placeholder="Email"
          className="input font-mono"
        />
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Password (8+ characters)"
          className="input font-mono"
        />
        {showLegacy && (
          <div className="space-y-1 rounded border border-border p-2">
            <input
              type="password"
              name="legacy"
              autoComplete="off"
              placeholder="Current shared password (optional)"
              className="input font-mono"
            />
            <p className="text-xs text-text-muted">
              Enter the app&apos;s current shared password to move all existing data into this account.
              Only works once.
            </p>
          </div>
        )}
        <button
          type="submit"
          className="w-full rounded bg-accent px-3 py-1.5 text-sm font-medium text-bg hover:bg-accent-dim"
        >
          Create account
        </button>
        <p className="text-center text-xs text-text-muted">
          Already have an account?{" "}
          <Link href={loginHref} className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
