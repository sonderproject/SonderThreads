import Link from "next/link";
import { BrandLockup } from "@/components/BrandLockup";
import { resetPassword } from "@/app/login/actions";
import { getAuthState } from "@/lib/session";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  short: "Password must be at least 8 characters.",
  match: "The two passwords don't match.",
  weak: "Choose a stronger password.",
  same: "That's your current password. Choose a new one.",
  failed: "Couldn't update your password. Please try again.",
};

/** Reached from the emailed reset link, which signs the person in (/auth/confirm) to set a new password. */
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const state = await getAuthState();
  const signedIn = state.status !== "signed-out";

  return (
    <div className="flex min-h-screen items-start justify-center bg-bg px-4 pt-32">
      <div className="w-full max-w-xs space-y-3">
        <BrandLockup className="mb-2" />
        {error === "invalid" || !signedIn ? (
          <p className="text-sm text-danger">
            This reset link has expired or was already used.{" "}
            <Link href="/forgot-password" className="text-accent hover:underline">
              Send a new one
            </Link>
          </p>
        ) : (
          <form action={resetPassword} className="space-y-3">
            <h1 className="section-title">Choose a new password</h1>
            {error && <p className="text-xs text-danger">{ERRORS[error] ?? ERRORS.failed}</p>}
            <input
              type="password"
              name="password"
              required
              minLength={8}
              autoFocus
              autoComplete="new-password"
              placeholder="New password (8+ characters)"
              className="input tabular-nums"
            />
            <input
              type="password"
              name="confirm"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Type it again"
              className="input tabular-nums"
            />
            <button
              type="submit"
              className="w-full rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-bg hover:bg-accent-dim"
            >
              Save password and continue
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
