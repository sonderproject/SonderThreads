import { queryOne } from "@/lib/db/client";

export type FunnelStep = { label: string; count: number };

/**
 * Owner command center: how many people reached each guided set-up step
 * (lib/setup.ts) in the last `days` days. Counted from app_events: once per
 * set-up id before sign-up, once per account after. Likely bots excluded.
 * Owner-only (app/(app)/owner, behind requireOwner()).
 */
export async function setupFunnel(days: number): Promise<{ org: FunnelStep[]; solo: FunnelStep[] }> {
  const r = await queryOne<Record<string, number>>(
    `with e as (select kind, message, meta from app_events where created_at > now() - make_interval(days => $1))
     select
       (select count(distinct meta->>'fid') from e where kind = 'funnel.org.basics')::int as org1,
       (select count(distinct meta->>'fid') from e where kind = 'funnel.org.services')::int as org2,
       (select count(*) from e where kind = 'auth.signup' and meta->>'flow' = 'org' and message not ilike '%bot%')::int as org3,
       (select count(*) from e where kind = 'setup.org_created')::int as org4,
       (select count(distinct meta->>'user') from e where kind = 'funnel.org.started')::int as org5,
       (select count(distinct meta->>'user') from e where kind = 'setup.done' and meta->>'flow' = 'org')::int as org6,
       (select count(distinct meta->>'fid') from e where kind = 'funnel.solo.basics')::int as solo1,
       (select count(*) from e where kind = 'auth.signup' and meta->>'flow' = 'solo' and message not ilike '%bot%')::int as solo2,
       (select count(*) from e where kind = 'setup.solo_started')::int as solo3,
       (select count(distinct meta->>'user') from e where kind = 'setup.done' and meta->>'flow' = 'solo')::int as solo4`,
    [days],
  );
  const n = (k: string) => r?.[k] ?? 0;
  return {
    org: [
      { label: "Answered organization questions", count: n("org1") },
      { label: "Picked services", count: n("org2") },
      { label: "Created account", count: n("org3") },
      { label: "Verified email (organization created)", count: n("org4") },
      { label: "Started trial or paid", count: n("org5") },
      { label: "Finished set-up", count: n("org6") },
    ],
    solo: [
      { label: "Answered \"what will you use it for\"", count: n("solo1") },
      { label: "Created account", count: n("solo2") },
      { label: "Verified email", count: n("solo3") },
      { label: "Finished set-up", count: n("solo4") },
    ],
  };
}
