import Link from "next/link";
import { Turnstile } from "@/components/auth/Turnstile";
import { login } from "./actions";
import { missingSupabaseConfig } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  invalid: "Wrong email or password.",
  captcha: "Please complete the security check and try again.",
  rate: "Too many attempts. Wait a minute and try again.",
  link: "That link has expired or was already used. Sign in, or request a new email.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; email?: string; reason?: string; reset?: string }>;
}) {
  const { error, next, email, reason, reset } = await searchParams;
  const signupHref = next ? `/signup?next=${encodeURIComponent(next)}` : "/signup";
  const missing = missingSupabaseConfig();

  return (
    <div className="flex min-h-screen items-start justify-center bg-bg px-4 pt-32">
      <form action={login} className="w-full max-w-xs space-y-3">
        <p className="font-display text-xl font-semibold text-accent">sonderthreads</p>
        {missing.length > 0 && (
          <p className="flag text-xs">Sign-in isn&apos;t configured yet. Missing: {missing.join(", ")}.</p>
        )}
        {reason === "idle" && !error && (
          <p className="text-xs text-text-muted">You were signed out after 30 minutes of inactivity.</p>
        )}
        {reset && !error && <p className="text-xs text-accent">Password updated. Sign in with your new password.</p>}
        {error && <p className="text-xs text-danger">{ERRORS[error] ?? ERRORS.invalid}</p>}
        <input type="hidden" name="next" value={next ?? ""} />
        <input
          type="email"
          name="email"
          required
          autoFocus={!email}
          defaultValue={email ?? ""}
          autoComplete="email"
          placeholder="Email"
          className="input tabular-nums"
        />
        <input
          type="password"
          name="password"
          required
          autoFocus={!!email}
          autoComplete="current-password"
          placeholder="Password"
          className="input tabular-nums"
        />
        <Turnstile />
        <button
          type="submit"
          className="w-full rounded bg-accent px-3 py-1.5 text-sm font-medium text-bg hover:bg-accent-dim"
        >
          Sign in
        </button>
        <p className="text-center text-xs">
          <Link href="/forgot-password" className="text-text-muted hover:text-accent hover:underline">
            Forgot password?
          </Link>
        </p>
        <p className="text-center text-xs text-text-muted">
          New here?{" "}
          <Link href={signupHref} className="text-accent hover:underline">
            Create an account
          </Link>
        </p>
      </form>
    </div>
  );
}
