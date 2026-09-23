# Client Command Center

A minimal, command-first personal tracker for staying on top of clients, notes, lists, cohorts, and tasks. Terminal-inspired, dark, and fast — not a CRM.

## Stack

- Next.js 15 (App Router, Server Actions) + TypeScript
- Tailwind CSS
- Postgres (Vercel's native Postgres storage, or any Postgres instance)
- Deployed on Vercel

## How it works

- **One command bar.** Type natural language ("Add Marcus Johnson to Cohort 7", "Remind me to call Marcus Friday") and the app figures out what you meant.
- **No AI key required.** `lib/ai/command-parser.ts` and `lib/ai/client-summary.ts` are provider-agnostic. Out of the box they use a deterministic, regex-based fallback parser (`lib/ai/providers/fallback.ts`) so the app is fully functional with zero API keys. Set `AI_PROVIDER=openai` or `AI_PROVIDER=anthropic` plus the matching API key to upgrade to model-based parsing/summaries.
- **Single-user, no login.** There's exactly one owner (a fixed id in `lib/db/constants.ts`) and no authentication layer at all — the app talks directly to Postgres with a plain connection string. Every table still has a `user_id` column, so real per-user accounts can be added later without a schema change.

## Setup

### 1. Get a Postgres database

Easiest path — Vercel's own Storage tab:

1. In your Vercel project, go to **Storage → Create Database → Postgres**.
2. Vercel provisions it and automatically injects a connection string as an environment variable (usually `POSTGRES_URL`, sometimes `DATABASE_URL` depending on how it's provisioned — this app checks both, plus `POSTGRES_PRISMA_URL` and `POSTGRES_URL_NON_POOLING`, so either works).

Any other Postgres works too (Neon, Railway, a local install) — just put its connection string in `POSTGRES_URL`.

### 2. Run the schema

Run `db/schema.sql` against that database once. This creates all tables (`clients`, `notes`, `lists`, `list_items`, `tasks`, `client_summaries`, `activity`) and indexes.

- From Vercel's Storage tab, open the database's **Query** editor and paste the file's contents, or
- From a terminal: `psql "$POSTGRES_URL" -f db/schema.sql`

(There's no separate seed script to run — the app seeds its own demo data automatically the first time you open it with an empty database.)

### 3. Configure environment variables

Copy `.env.example` to `.env.local` and set your connection string:

```
POSTGRES_URL=postgres://user:password@host:5432/dbname
```

AI provider variables are optional — leave `AI_PROVIDER` unset to use the built-in fallback parser.

### 4. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The dashboard seeds demo clients (Marcus Johnson, James Smith, Wes Carter), a "Cohort 7" list, and a few notes/tasks the first time you load it.

### 5. Deploy to Vercel

Push to a Git repo and import it into Vercel. If you provisioned the database from Vercel's Storage tab in step 1 and it's connected to this project, `POSTGRES_URL` is already set — no manual env var configuration needed. Otherwise, set `POSTGRES_URL` (and optionally `AI_PROVIDER` + API key) in the project's Environment Variables, then deploy.

## Project structure

```
app/(app)/            Dashboard, clients, lists, tasks, notes pages (behind the shared nav shell)
components/            UI: nav shell, command bar, quick-action modals, cards, list/task/note components
lib/actions/           Server Actions — all reads/writes to Postgres, activity logging, search
lib/ai/                Provider-agnostic command parser + client summary generator, with a
                        deterministic fallback and pluggable OpenAI/Anthropic providers
lib/db/                Postgres connection pool + the single fixed owner id
lib/types.ts            Hand-written types matching the SQL schema
db/schema.sql           SQL schema (tables + indexes) — run this once against your database
```

## Notes on the command parser

`lib/ai/command-parser.ts` classifies free text into one of: `create_client`, `add_client_note`, `add_note`, `create_task`, `create_list`, `add_to_list`, `update_client_status`, `search`, or `unknown`, then `lib/actions/command.ts` executes it (creating/linking clients, notes, tasks, or lists) and returns a short confirmation. A cohort list (`is_cohort: true`) auto-creates client records for unmatched names, since a cohort is a roster of clients; a plain list just links to an existing client when the name matches.

## Troubleshooting

If the app shows a **"Setup issue: Database not reachable"** panel, it means `POSTGRES_URL` (or `DATABASE_URL`) either isn't set for this deployment, or the schema hasn't been run yet. Check:

1. Vercel project → **Storage** tab shows a Postgres database connected to this project
2. Vercel project → **Settings → Environment Variables** shows the connection string set for **Production**
3. `db/schema.sql` has been run against that database (step 2 above)
4. If you just added the database/variable, make sure a new deployment has actually run since — env vars don't retroactively apply to a build that already happened; push a commit or hit Redeploy
