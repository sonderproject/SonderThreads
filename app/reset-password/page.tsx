import Link from "next/link";
import { resetPassword } from "@/app/login/actions";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  return (
    <div className="flex min-h-screen items-start justify-center bg-bg px-4 pt-32">
      <div className="w-full max-w-xs space-y-3">
        <p className="font-mono text-lg text-accent">&gt; sonderthreads</p>
        {error === "invalid" || !token ? (
          <p className="text-sm text-danger">
            This reset link has expired or was already used.{" "}
            <Link href="/forgot-password" className="text-accent hover:underline">
              Send a new one
            </Link>
          </p>
        ) : (
          <form action={resetPassword} className="space-y-3">
            <p className="text-sm text-text-muted">Choose a new password.</p>
            {error === "short" && <p className="text-xs text-danger">Password must be at least 8 characters.</p>}
            <input type="hidden" name="token" value={token} />
            <input
              type="password"
              name="password"
              required
              minLength={8}
              autoFocus
              autoComplete="new-password"
              placeholder="New password (8+ characters)"
              className="input font-mono"
            />
            <button
              type="submit"
              className="w-full rounded bg-accent px-3 py-1.5 text-sm font-medium text-bg hover:bg-accent-dim"
            >
              Set password and sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
