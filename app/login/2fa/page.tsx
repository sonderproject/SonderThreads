import { redirect } from "next/navigation";
import { BrandLockup } from "@/components/BrandLockup";
import { verifyLogin2fa } from "@/lib/actions/security";
import { logout } from "@/app/login/actions";
import { safeNextPath } from "@/lib/auth";
import { getAuthState } from "@/lib/session";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  format: "Enter the 6-digit code from your authenticator app.",
  code: "That code didn't match. Codes change every 30 seconds; try the current one.",
};

/** Second sign-in step for accounts with two-factor authentication on. */
export default async function TwoFactorPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next: rawNext, error } = await searchParams;
  const next = safeNextPath(rawNext);
  const state = await getAuthState();
  if (state.status === "signed-out") redirect("/login");
  if (state.status === "signed-in") redirect(next);

  return (
    <div className="flex min-h-screen items-start justify-center bg-bg px-4 pt-32">
      <div className="w-full max-w-xs space-y-3">
        <BrandLockup className="mb-2" />
        <form action={verifyLogin2fa} className="space-y-3">
          <h1 className="section-title">Enter your code</h1>
          <p className="text-sm text-text-muted">
            Open your authenticator app and enter the 6-digit code for Sonder Threads ({state.email}).
          </p>
          {error && <p className="text-xs text-danger">{ERRORS[error] ?? ERRORS.code}</p>}
          <input type="hidden" name="next" value={next} />
          <input
            name="code"
            required
            autoFocus
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            autoComplete="one-time-code"
            placeholder="123456"
            className="input text-center text-lg tracking-[0.4em] tabular-nums"
          />
          <button
            type="submit"
            className="w-full rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-bg hover:bg-accent-dim"
          >
            Verify and continue
          </button>
        </form>
        <form action={logout} className="text-center">
          <button type="submit" className="text-xs text-text-muted hover:text-accent hover:underline">
            Use a different account
          </button>
        </form>
      </div>
    </div>
  );
}
