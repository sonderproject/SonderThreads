import { Pool, type QueryResultRow } from "pg";
import { SCHEMA_SQL } from "./schema";

/**
 * Vercel's native "Postgres" storage (powered by Neon) injects the
 * connection string under one of several names depending on how it was
 * provisioned. Check the common ones first, then fall back to scanning
 * every env var for something shaped like a Postgres connection string —
 * a different integration already surprised us once by injecting a
 * variable under a name nothing would have guessed.
 */
function resolveConnectionString(): string | undefined {
  const known =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING;
  if (known) return known;

  for (const [key, value] of Object.entries(process.env)) {
    if (value && /url/i.test(key) && /^postgres(ql)?:\/\//i.test(value)) {
      return value;
    }
  }

  return undefined;
}

let pool: Pool | undefined;

function getPool(): Pool {
  if (pool) return pool;

  const connectionString = resolveConnectionString();
  if (!connectionString) {
    throw new Error(
      "No Postgres connection string found. Set POSTGRES_URL (or DATABASE_URL) — " +
        "in Vercel, add the Postgres storage integration to this project; locally, " +
        "put it in .env.local.",
    );
  }

  const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);

  pool = new Pool({
    connectionString,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
    max: 10,
  });

  return pool;
}

/**
 * Creates the schema (tables/indexes) if it doesn't exist yet. Runs once
 * per warm server instance — every statement is `if not exists`, so it's
 * a cheap no-op once the schema is already there. This is what lets the
 * app self-provision on first request with zero manual setup: whoever
 * deploys it only has to point POSTGRES_URL/DATABASE_URL at an empty
 * database, nothing else.
 */
let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = getPool()
      .query(SCHEMA_SQL)
      .then(() => undefined)
      .catch((err) => {
        schemaReady = null; // allow retry on the next call instead of caching a failure forever
        throw err;
      });
  }
  return schemaReady;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  await ensureSchema();
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function checkDatabaseConnection(): Promise<{ ok: true } | { ok: false; detail: string }> {
  try {
    if (!resolveConnectionString()) {
      return {
        ok: false,
        detail:
          "No Postgres connection string is set. Add the Postgres storage integration " +
          "in Vercel (Storage tab → Create Database → Postgres).",
      };
    }
    await query("select 1 from clients limit 1");
    return { ok: true };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}
