# sonderthreads

A minimal, command-first personal tracker for staying on top of people, notes, lists, groups, and tasks. Terminal-inspired, dark, and fast — not a CRM.

## Stack

- Next.js 15 (App Router, Server Actions) + TypeScript
- Tailwind CSS
- Postgres (Vercel's native Postgres storage, or any Postgres instance)
- Deployed on Vercel

## How it works

- **One command bar.** Type natural language ("Add Marcus Johnson to Group 7", "Remind me to call Marcus Friday") and the app figures out what you meant.
- **No AI key required.** `lib/ai/command-parser.ts` and `lib/ai/person-summary.ts` are provider-agnostic. Out of the box they use a deterministic, regex-based fallback parser (`lib/ai/providers/fallback.ts`) so the app is fully functional with zero API keys. Set `AI_PROVIDER=openai` or `AI_PROVIDER=anthropic` plus the matching API key to upgrade to model-based parsing/summaries.
- **Single-user, no login.** There's exactly one owner (a fixed id in `lib/db/constants.ts`) and no authentication layer at all — the app talks directly to Postgres with a plain connection string. Every table still has a `user_id` column, so real per-user accounts can be added later without a schema change.
- **Groups, import, recurring tasks, stale flag.** Import a CSV (or a plain one-name-per-line file) from the People or Lists page to create a list of people — name/first+last, email, phone and birthday columns are recognized. Tasks can repeat daily/weekly/monthly (from the task forms, or "Remind me to call Marcus every Monday"); checking one off schedules the next. Anyone with no activity for 14+ days gets a **stale** badge.
- **Password-protected.** Every page and the export endpoint require the `APP_PASSWORD` environment variable's password (30-day sign-in, ⏻ in the header signs out). It's one shared password, so everyone who has it sees the same data. Per-user accounts are the next step before sharing the app.
- **Self-provisioning.** The app creates its own tables on first connection (`lib/db/client.ts` → `ensureSchema()`) and seeds demo data on first empty load. Point it at a brand-new, completely empty Postgres database and there is nothing else to run anywhere — no migration step, no SQL editor, no CLI command. Databases from before the People/Group rename (`clients`, `client_id`, `is_cohort`) are renamed in place on the next start — no data is dropped.

## Setup

### 1. Get a Postgres database

Easiest path — Vercel's own Storage tab:

1. In your Vercel project, go to **Storage → Create Database → Postgres**.
2. Vercel provisions it and automatically injects a connection string as an environment variable (usually `POSTGRES_URL`, sometimes `DATABASE_URL` — this app checks both, plus `POSTGRES_PRISMA_URL`/`POSTGRES_URL_NON_POOLING`, and as a last resort scans every env var for anything shaped like a Postgres URL, so it finds it regardless of the name an integration gives it).

Any other Postgres works too (Neon, Railway, a local install) — just put its connection string in `POSTGRES_URL`.

That's the entire setup. The first request the app handles creates all its tables automatically (`people`, `notes`, `lists`, `list_items`, `tasks`, `person_summaries`, `activity`) and seeds demo data — `db/schema.sql` is kept only as a human-readable reference of what gets created; nothing needs to be run against the database by hand.

### 2. Configure environment variables

Copy `.env.example` to `.env.local` and set your connection string:

```
POSTGRES_URL=postgres://user:password@host:5432/dbname
```

AI provider variables are optional — leave `AI_PROVIDER` unset to use the built-in fallback parser.

### 3. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The dashboard creates its tables and seeds demo people (Marcus Johnson, James Smith, Wes Carter), a "Group 7" list, and a few notes/tasks the first time you load it.

### 4. Deploy to Vercel

Push to a Git repo and import it into Vercel. If you provisioned the database from Vercel's Storage tab in step 1 and it's connected to this project, the connection string is already set — no manual env var configuration needed. Otherwise, set `POSTGRES_URL` (and optionally `AI_PROVIDER` + API key) in the project's Environment Variables, then deploy.

## Project structure

```
app/(app)/            Dashboard, people, lists, tasks, notes pages (behind the shared nav shell)
components/            UI: nav shell, command bar, quick-action modals, cards, list/task/note components
lib/actions/           Server Actions — all reads/writes to Postgres, activity logging, search
lib/ai/                Provider-agnostic command parser + person summary generator, with a
                        deterministic fallback and pluggable OpenAI/Anthropic providers
lib/db/                Postgres connection pool + the single fixed owner id
lib/types.ts            Hand-written types matching the SQL schema
db/schema.sql           SQL schema (tables + indexes) — run this once against your database
```

## Notes on the command parser

`lib/ai/command-parser.ts` classifies free text into one of: `create_person`, `add_person_note`, `add_note`, `create_task`, `create_list`, `add_to_list`, `update_person_status`, `search`, or `unknown`, then `lib/actions/command.ts` executes it (creating/linking people, notes, tasks, or lists) and returns a short confirmation. A group list (`is_group: true`) auto-creates person records for unmatched names, since a group is a roster of people; a plain list just links to an existing person when the name matches.

## Troubleshooting

If the app shows a **"Setup issue: Database not reachable"** panel, it means `POSTGRES_URL` (or `DATABASE_URL`) isn't set for this deployment yet (the app creates its own tables automatically, so a missing/misnamed connection string is the only thing left that can cause this). Check:

1. Vercel project → **Storage** tab shows a Postgres database connected to this project
2. Vercel project → **Settings → Environment Variables** shows the connection string set for **Production**
3. If you just added the database/variable, make sure a new deployment has actually run since — env vars don't retroactively apply to a build that already happened; push a commit or hit Redeploy
