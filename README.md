# Client Command Center

A minimal, command-first personal tracker for staying on top of clients, notes, lists, cohorts, and tasks. Terminal-inspired, dark, and fast — not a CRM.

## Stack

- Next.js 15 (App Router, Server Actions) + TypeScript
- Tailwind CSS
- Supabase (Postgres, Auth, Row Level Security)
- Deployed on Vercel

## How it works

- **One command bar.** Type natural language ("Add Marcus Johnson to Cohort 7", "Remind me to call Marcus Friday") and the app figures out what you meant.
- **No AI key required.** `lib/ai/command-parser.ts` and `lib/ai/client-summary.ts` are provider-agnostic. Out of the box they use a deterministic, regex-based fallback parser (`lib/ai/providers/fallback.ts`) so the app is fully functional with zero API keys. Set `AI_PROVIDER=openai` or `AI_PROVIDER=anthropic` plus the matching API key to upgrade to model-based parsing/summaries.
- **Single-user, no login screen (for now).** The app transparently creates a Supabase **anonymous session** on first visit (see `lib/supabase/middleware.ts`), so there's nothing to sign into. Every row is still scoped by `user_id` and protected by RLS, so real email/magic-link login (already scaffolded at `app/login`) can be turned back on later without any schema changes — an anonymous user can be upgraded in place via Supabase's identity linking.

## Setup

### 1. Create a Supabase project

Create a project at [supabase.com](https://supabase.com/dashboard).

### 2. Enable anonymous sign-ins

In the Supabase dashboard: **Authentication → Providers → Anonymous Sign-ins → Enable**. This is required since the app signs visitors in anonymously instead of showing a login screen.

### 3. Run the migration

In the Supabase SQL Editor, run the contents of `supabase/migrations/0001_init.sql`. This creates all tables (`profiles`, `clients`, `notes`, `lists`, `list_items`, `tasks`, `client_summaries`, `activity`), indexes, and RLS policies.

(`supabase/seed.sql` is optional — the app seeds its own demo data automatically the first time you open it with an empty account. Use the SQL file only if you want to seed via SQL directly.)

### 4. Configure environment variables

Copy `.env.example` to `.env.local` and fill in your project's URL and anon key (Supabase dashboard → Settings → API):

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

AI provider variables are optional — leave `AI_PROVIDER` unset to use the built-in fallback parser.

### 5. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The dashboard seeds demo clients (Marcus Johnson, James Smith, Wes Carter), a "Cohort 7" list, and a few notes/tasks the first time you load it.

### 6. Deploy to Vercel

Push to a Git repo, import it into Vercel, and set the same environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and optionally `AI_PROVIDER` + API key) in the Vercel project settings. `NEXT_PUBLIC_*` variables must be set **before** the build runs, since Next.js inlines them at build time.

## Project structure

```
app/(app)/            Dashboard, clients, lists, tasks, notes pages (behind the shared nav shell)
app/login/             Dormant email/magic-link login screen (not currently wired into the auth flow)
app/auth/callback/     OAuth/magic-link callback route handler
components/            UI: nav shell, command bar, quick-action modals, cards, list/task/note components
lib/actions/           Server Actions — all reads/writes to Supabase, activity logging, search
lib/ai/                Provider-agnostic command parser + client summary generator, with a
                        deterministic fallback and pluggable OpenAI/Anthropic providers
lib/supabase/          Browser/server Supabase clients + middleware session handling
lib/types.ts            Hand-written Database types matching the SQL schema
supabase/migrations/   SQL schema + RLS policies
supabase/seed.sql       Optional manual seed script
```

## Notes on the command parser

`lib/ai/command-parser.ts` classifies free text into one of: `create_client`, `add_client_note`, `add_note`, `create_task`, `create_list`, `add_to_list`, `update_client_status`, `search`, or `unknown`, then `lib/actions/command.ts` executes it (creating/linking clients, notes, tasks, or lists) and returns a short confirmation. A cohort list (`is_cohort: true`) auto-creates client records for unmatched names, since a cohort is a roster of clients; a plain list just links to an existing client when the name matches.

## Troubleshooting: "Setup issue: Missing environment variables" on the deployed site

This means the deployed app genuinely doesn't have `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` at build time. It is a Vercel configuration problem, not a code problem — the two things that most commonly cause it even after "adding" the variables:

1. **Environment scope.** In Vercel's Environment Variables screen, each variable has checkboxes for **Production / Preview / Development**. If "Production" isn't checked, the variable will not exist on your live (production) deployment, even though it's saved. Make sure both variables have **Production** checked.
2. **Redeploy after adding.** `NEXT_PUBLIC_*` variables are baked into the JavaScript bundle at build time — adding/changing them does **not** retroactively update a deployment that already ran. You must trigger a new build afterward (push a commit, or Deployments → "..." → Redeploy).
3. **Exact spelling.** The names must be exactly `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` — case-sensitive, no leading/trailing spaces.

To verify: Vercel project → **Settings → Environment Variables** should list both names with **Production** checked, and the **Deployments** tab's latest entry should be timestamped *after* you saved them.

## Known limitation (this build environment)

This build was verified with `npm run build` (TypeScript + Next.js compile cleanly) and a local `npm run dev` smoke test of the static `/login` route. The authenticated routes (dashboard, clients, lists, tasks, notes) require a live, reachable Supabase project — they weren't exercised end-to-end here because no real Supabase project was available in this sandbox. Once you've completed steps 1–4 above, every one of the pages/actions above should work; if anything doesn't, let us know the exact page/action and the error message.
