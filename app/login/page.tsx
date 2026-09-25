import { getAppPassword } from "@/lib/auth";
import { login } from "./actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const configured = getAppPassword() !== null;

  return (
    <div className="flex min-h-screen items-start justify-center bg-bg px-4 pt-32">
      <form action={login} className="w-full max-w-xs space-y-3">
        <p className="font-mono text-lg text-accent">&gt; sonderthreads</p>
        {!configured ? (
          <p className="text-sm text-danger">
            No password is set. Add an APP_PASSWORD environment variable (in Vercel: Settings →
            Environment Variables), then redeploy.
          </p>
        ) : (
          <>
            {error && <p className="text-xs text-danger">Wrong password.</p>}
            <input type="hidden" name="next" value={next ?? ""} />
            <input
              type="password"
              name="password"
              autoFocus
              autoComplete="current-password"
              placeholder="Password"
              className="input font-mono"
            />
            <button
              type="submit"
              className="w-full rounded bg-accent px-3 py-1.5 text-sm font-medium text-bg hover:bg-accent-dim"
            >
              Enter
            </button>
          </>
        )}
      </form>
    </div>
  );
}
