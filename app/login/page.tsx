import Link from "next/link";
import { login } from "./actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; email?: string }>;
}) {
  const { error, next, email } = await searchParams;
  const signupHref = next ? `/signup?next=${encodeURIComponent(next)}` : "/signup";

  return (
    <div className="flex min-h-screen items-start justify-center bg-bg px-4 pt-32">
      <form action={login} className="w-full max-w-xs space-y-3">
        <p className="font-mono text-lg text-accent">&gt; sonderthreads</p>
        {error && <p className="text-xs text-danger">Wrong email or password.</p>}
        <input type="hidden" name="next" value={next ?? ""} />
        <input
          type="email"
          name="email"
          required
          autoFocus={!email}
          defaultValue={email ?? ""}
          autoComplete="email"
          placeholder="Email"
          className="input font-mono"
        />
        <input
          type="password"
          name="password"
          required
          autoFocus={!!email}
          autoComplete="current-password"
          placeholder="Password"
          className="input font-mono"
        />
        <button
          type="submit"
          className="w-full rounded bg-accent px-3 py-1.5 text-sm font-medium text-bg hover:bg-accent-dim"
        >
          Sign in
        </button>
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
