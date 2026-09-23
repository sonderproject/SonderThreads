import { checkDatabaseConnection } from "@/lib/db/client";

export type Diagnostic = { ok: true } | { ok: false; reason: string; detail: string };

/**
 * Checks whether the database is reachable, without throwing. Used by the
 * (app) layout to show the real cause of a setup problem directly in the
 * page instead of a thrown error — Next.js redacts thrown Server Component
 * error messages in production regardless of error.tsx, so this is the
 * only way to surface the actual reason.
 */
export async function checkSetup(): Promise<Diagnostic> {
  const result = await checkDatabaseConnection();

  if (!result.ok) {
    return { ok: false, reason: "Database not reachable", detail: result.detail };
  }

  return { ok: true };
}
