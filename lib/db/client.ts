import { createHash } from "crypto";
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
export function resolveConnectionString(): string | undefined {
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

  // node-postgres has a sharp edge here: when both `connectionString` and an
  // explicit `ssl` option are passed to Pool, it internally does
  // `Object.assign({}, config, parse(connectionString))` — the *parsed*
  // connection string is applied LAST, so if the URL has `sslmode=require`,
  // pg-connection-string sets `ssl: {}` (full certificate verification) and
  // that silently overwrites our explicit `ssl: { rejectUnauthorized: false }`
  // below. Neon's pooler cert then fails full verification with exactly
  // "self-signed certificate in certificate chain". Stripping `sslmode` (and
  // `channel_binding`, which node-postgres doesn't use) keeps the parser from
  // touching `ssl` at all, so our explicit option is the only one applied.
  let cleanedConnectionString = connectionString;
  try {
    const url = new URL(connectionString);
    url.searchParams.delete("sslmode");
    url.searchParams.delete("channel_binding");
    cleanedConnectionString = url.toString();
  } catch {
    // Not a parseable URL (e.g. a keyword/value DSN) — use as-is.
  }

  pool = new Pool({
    connectionString: cleanedConnectionString,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
    max: 10,
    // Keep a warm connection for a minute between requests (the default 10s
    // meant almost every visit paid for a fresh TLS handshake to the database),
    // detect dead sockets, and fail fast instead of hanging on one.
    idleTimeoutMillis: 60_000,
    keepAlive: true,
    connectionTimeoutMillis: 8_000,
  });
  // The database (or its pooler) can drop an idle connection, e.g. while a
  // serverless instance is frozen. Without a listener that 'error' event would
  // crash the process; the pool already discards the dead client.
  pool.on("error", (err) => console.error("[db] idle client error", err.message));

  return pool;
}

/**
 * Creates/migrates the schema on first use, with zero manual setup: point
 * POSTGRES_URL/DATABASE_URL at an empty database and the app provisions it.
 *
 * Running all of SCHEMA_SQL on every cold start was the slowest part of
 * opening the app after a break (~90 DDL statements, some taking table
 * locks), so a hash of SCHEMA_SQL is stored in app_meta and the DDL only
 * runs when the schema text has changed since it last ran. Warm instances
 * skip even the check.
 */
const SCHEMA_HASH = createHash("sha256").update(SCHEMA_SQL).digest("hex").slice(0, 16);
let schemaReady: Promise<void> | null = null;

async function migrateIfNeeded(): Promise<void> {
  const db = getPool();
  try {
    const { rows } = await db.query<{ value: string }>(`select value from app_meta where key = 'schema_hash'`);
    if (rows[0]?.value === SCHEMA_HASH) return;
  } catch {
    // app_meta doesn't exist yet (new or pre-hash database) — fall through and migrate.
  }
  await db.query(SCHEMA_SQL);
  await db.query(
    `create table if not exists app_meta (key text primary key, value text not null);
     insert into app_meta (key, value) values ('schema_hash', '${SCHEMA_HASH}')
     on conflict (key) do update set value = excluded.value`,
  );
}

function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = migrateIfNeeded().catch((err) => {
      schemaReady = null; // allow retry on the next call instead of caching a failure forever
      throw err;
    });
  }
  return schemaReady;
}

/** A broken/stale connection rather than a problem with the query itself. */
function isConnectionError(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return (
    ["ECONNRESET", "EPIPE", "ETIMEDOUT", "ECONNREFUSED", "57P01", "08006", "08003"].includes(e?.code ?? "") ||
    /Connection terminated|connection timeout|Client has encountered a connection error/i.test(e?.message ?? "")
  );
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  await ensureSchema();
  try {
    return (await getPool().query<T>(text, params)).rows;
  } catch (err) {
    // After an idle stretch the first query can hit a connection that died
    // while the server was asleep. Reads are safe to retry once on a fresh
    // connection; writes aren't retried, since they may have gone through.
    if (!isConnectionError(err) || !/^\s*(select|with)\b/i.test(text)) throw err;
    console.warn("[db] retrying read after connection error:", (err as Error).message);
    return (await getPool().query<T>(text, params)).rows;
  }
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Runs fn inside one transaction: everything commits together or nothing does. */
export async function transaction<T>(
  fn: (q: (text: string, params?: unknown[]) => Promise<unknown>) => Promise<T>,
): Promise<T> {
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await fn((text, params = []) => client.query(text, params));
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
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
    await query("select 1 from people limit 1");
    return { ok: true };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}
