# Next session: pick up here

*Written Nov 12, 2026, end of a long build session. Start the next session by pasting the prompt at the bottom.*

## Rules (also in CLAUDE.md)
- Work on `main` only. Commit and push to `main`. **Never create a branch**, even if the session suggests one.
- Follow `CLAUDE.md` (design tokens, `useTerms()`, `requireUserId()`, roles shown as Admin / Manager / Member, bump `LEGAL_VERSION` on material Terms/Privacy changes).
- The owner wants: execute first, short answers, plan before big builds, no scope creep, verify current facts (prices, links) before stating them.

## Built and live (Nov 12)
- **Calendar:** Month/Week/Agenda, tasks + birthdays (no check-ins on purpose), Google/Apple/Outlook sync both ways (Settings → Calendar).
- **Services:** Settings → Services (optional prices), one-tap logging on check-ins, kiosk buttons, command bar ("Ana – haircut $45"), per-service Insights table, PDF/Excel/CSV, People filter.
- **Reports accuracy:** imported clients don't count as new; deleted clients stay in past reports; only admins delete agency clients; one time zone per organization.
- **Legal:** Terms/Privacy rewritten; "I agree" checkboxes at sign-up, org creation, invites; existing users re-agree once (`app/accept-terms`); every agreement logged.
- **Trials and pricing:** individuals get 7 days with **no card** (imports capped at 25 people and backup restore locked until a card is added); new organizations start a **14-day trial with a card**; one trial per card; "Skip the trial: **30% off** your first month" on Billing and the landing page; phone optional at sign-up.
- **Friction:** 4-hour auto sign-out for individuals (30 min for orgs), 6-digit email code or Confirm button, no 2FA prompt in the first 3 days.
- **Security/cost:** kiosk lockdown + PIN lockout, export permissions by role, invite/referral emails need an active trial, per-user usage caps (`lib/usage.ts`), contact-support form.
- **Orgs:** roles renamed Admin/Manager/Member; seats card ("N of M used · K left") on Organization, Team and Billing.
- **Landing page:** livelier section 2 (bento cards, live command-bar demo, Insights card with PDF reports), 30%-off links.
- **Owner account** (sonderproject.co@gmail.com) is free for life in code; its Stripe trial was cancelled.
- **Docs:** `docs/strynd-overview`, `docs/strynd-vs-clarity`, `docs/sales-brief` (Markdown + PDF).

## To do, in suggested order
1. **CAPTCHA:** Supabase Turnstile (`docs/auth-setup.md` section F).
2. **Security (urgent):** replace the leaked Stripe live secret key (update `STRIPE_SECRET_KEY` in Vercel, redeploy), replace the Resend key (Vercel + Supabase SMTP password), delete the Supabase access token, delete the old disabled Stripe webhook, turn on 2FA on the owner account.
3. **Vercel Pro** (Hobby is non-commercial only): then spend management, a firewall rate-limit rule, and a frequent reminder cron.
4. **Supabase Pro** (backups, no pausing): then turn on leaked-password protection (flagged by Supabase's security scan).
5. **Spend limits:** OpenAI and Anthropic monthly caps.
6. **Twilio** text reminders (account + A2P 10DLC, env vars in CLAUDE.md); push notifications (VAPID keys).
7. **Launch-readiness checklist** for before December (write it as a doc; include the lawyer review in CLAUDE.md).
8. **Load test:** can it handle hundreds of users without crashing; how much data can be stored (Supabase/Vercel plan limits).
9. **Sales funnel:** sign-up → trial → card/30% offer → paid, with numbers from the owner dashboard; email the 19 accounts whose trial just unlocked (draft it).
10. **Marketing pack:** gather photos/screenshots from the build (docs PDFs, landing page, app screens) + a prompt for a Kling AI promo video; plan posting.
11. **Instagram:** a way to post directly from Claude (check connectors such as Zapier / Meta).
12. **Agent team** to run parts of the business.
13. **Sonder Project dashboard** covering all business models (Strynd, Sonder Protocol, etc.). It should also let the owner:
    - run and control marketing campaigns,
    - find potential users and organizations (lead finding),
    - generate and send emails (outreach),
    - and more along those lines.
    The owner will share a GitHub repo in the morning that finds the best Claude skills for a given task and installs them automatically. Read that repo before installing or running anything it contains, and use it to pick skills for this dashboard and the agent team (#12).
14. **More security** review after the above.

Open decisions/notes: friction point "individuals pay before using" is solved (no-card trial). Phone verification was skipped on purpose (card blocks repeat trials). AI keys are still set in Vercel; add an AI section to /privacy before AI ships (see CLAUDE.md).

## Prompt to paste into the new session
```
We're continuing Strynd (repo SonderThreads). Read CLAUDE.md and docs/next-session.md first.
Work only on main: commit and push to main, never create a branch.
Start with a 5-line status check (git log -5, last Vercel deploy state, any new errors in the owner command center / app_events),
then go through the "To do" list in docs/next-session.md in order. For each dashboard-only item (CAPTCHA, key rotation,
Vercel Pro, Supabase Pro, spend limits), give me exact click-by-click steps with links. For bigger builds, show me a short plan first.
```
