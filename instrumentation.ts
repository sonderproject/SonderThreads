/**
 * Next.js calls onRequestError for every uncaught server error (pages,
 * server actions, API routes). They're saved for the owner's command center
 * (/owner), and a burst of them emails the owner.
 */
export async function register() {}

export async function onRequestError(
  err: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string },
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const e = err as Error & { digest?: string };
  // redirect() and notFound() travel as errors; they aren't problems.
  if (typeof e?.digest === "string" && (e.digest.startsWith("NEXT_REDIRECT") || e.digest.startsWith("NEXT_HTTP_ERROR_FALLBACK")))
    return;
  const { logEvent, alertOwner } = await import("@/lib/events");
  const { queryOne } = await import("@/lib/db/client");
  await logEvent("app.error", e?.message || String(err), {
    level: "error",
    path: request.path,
    meta: { method: request.method, route: context.routePath, type: context.routeType, digest: e?.digest ?? null },
  });
  try {
    const recent = await queryOne<{ n: number }>(
      `select count(*)::int as n from app_events where level = 'error' and created_at > now() - interval '10 minutes'`,
    );
    if ((recent?.n ?? 0) >= 5) {
      await alertOwner("Errors are spiking", [`${recent!.n} errors in the last 10 minutes.`, `Latest: ${e?.message ?? err} (${request.path})`], {
        everyMinutes: 60,
      });
    }
  } catch {
    // never let error reporting throw
  }
}
