import { Pool, type QueryResultRow } from "pg";

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

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
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
          "in Vercel (Storage tab → Create Database → Postgres), or set POSTGRES_URL / " +
          "DATABASE_URL locally.",
      };
    }
    await query("select 1");

    try {
      await query("select 1 from clients limit 1");
    } catch (schemaErr) {
      const message = schemaErr instanceof Error ? schemaErr.message : String(schemaErr);
      if (/relation .* does not exist/i.test(message)) {
        return {
          ok: false,
          detail:
            "Connected to the database, but the tables don't exist yet. Run db/schema.sql " +
            "against it once (Vercel's Query tab, or `psql \"$POSTGRES_URL\" -f db/schema.sql`).",
        };
      }
      throw schemaErr;
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}
