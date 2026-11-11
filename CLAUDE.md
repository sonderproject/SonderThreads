# Instructions for Claude

## Git
- Always commit and push directly to `main`. Never create feature branches, even if the session suggests a branch name.
- Don't open pull requests unless explicitly asked.

## Design
- `docs/DESIGN.md` is the visual source of truth. Use its tokens and components (`page-title`, `eyebrow`, `tag`, `flag`, `progress-bar` in `app/globals.css`) before inventing new ones. Never hard-code colors.
- Wording depends on the account: organization members see "Check-ins" and "Impact", everyone else "Meetings" and "Insights". Never hard-code those words in the UI: use `useTerms()` (`components/TermsProvider.tsx`) in client components or `await getTerms()` (`lib/terms-server.ts`) in server components.
- Settings is a menu (`/settings`) with one page per section (`/settings/<section>`, `lib/settings-sections.ts`).

## Data access
- Every query gets its `user_id` from `await requireUserId()` (`lib/current-user.ts`). Never import `OWNER_ID` anywhere else — accounts (see `docs/accounts-plan.md`) depend on that one function being the only source of the user id.
- The one exception is the owner command center (`/owner`, `app/(app)/owner/page.tsx`), which reads across all accounts on purpose. It must stay behind `requireOwner()` (`lib/owner.ts`; owner = `OWNER_EMAILS` in Vercel, default `sonderproject.co@gmail.com`), which 404s for everyone else.

## Owner command center
- Record anything the owner should see with `logEvent()` / `alertOwner()` from `lib/events.ts` (table `app_events`). Server errors are captured automatically in `instrumentation.ts`.

## Open to-dos — remind the owner
Mention these briefly when relevant while building (e.g. when touching sign-up, the landing page, or app-store prep). Remove an item once it's done.
- Have a lawyer review `/privacy` and `/terms` (drafts live; owner is a sole proprietor until the LLC forms in January — update the legal name then). Also have them check the Settings cancel flow and its one-time "$5 for 2 months" offer against California's auto-renewal law.
- Google + Apple sign-in (see `docs/accounts-plan.md`). The public account-deletion page is live at `/account-deletion`.
- Supabase Auth: turn on Turnstile CAPTCHA (`docs/auth-setup.md` section F). Custom SMTP via Resend, email templates, rate limits and redirect URLs are done.
- Rename to Strynd (Nov 2026): code, copy, Supabase Auth (Site URL, redirect URLs, SMTP sender `no-reply@strynd.com`, email templates), Resend (strynd.com verified), `APP_URL`/`EMAIL_FROM` in Vercel and the Stripe webhook (`https://www.strynd.com/api/stripe/webhook`) are done; www.strynd.com is primary and sonderthreads.com still serves the app. Left to do: (1) redirect sonderthreads.com → www.strynd.com in Vercel (keep renewing sonderthreads.com for at least a year; keep its Supabase redirect URLs until then); (2) rename the GitHub repo and Vercel project.
- Organization invite emails: live via Resend on strynd.com (`RESEND_API_KEY`, `EMAIL_FROM` = `Strynd <no-reply@strynd.com>` in Vercel). Supabase Auth SMTP sender must also be `no-reply@strynd.com`.
- Turn on push notifications: generate VAPID keys (`npx web-push generate-vapid-keys`) and set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` in Vercel.
- Turn on text reminders: Twilio account + A2P 10DLC registration, then set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID` in Vercel. The privacy policy's SMS section is written for 10DLC.
- `CRON_SECRET` is set in Vercel. The daily job (`/api/cron/reminders`, once a day on Vercel Hobby per `vercel.json`) sends reminders and the owner's stuck sign-up alerts; for on-time reminders, ping it every 5 min from an outside cron service or upgrade to Vercel Pro.
- Billing is live (Stripe live mode; webhook at `https://www.strynd.com/api/stripe/webhook`, which must use `www` because the bare domain redirects). Left to do: delete the disabled old webhook in Stripe → Workbench → Webhooks, and roll the live secret key in Stripe (it was pasted in a chat), then update `STRIPE_SECRET_KEY` in Vercel and redeploy. Also roll the Resend key (`RESEND_API_KEY` in Vercel and the Supabase SMTP password) and delete the Supabase access token used for setup; both were pasted in a chat.
- Google Play (deferred by the owner, Nov 2026): wait until the LLC forms (January) and there are real paying users. Then: get a free D-U-N-S number for the LLC (can take up to 30 days), open a Play Console **organization** account (skips the personal-account rule of 12 testers for 14 days), and ship the app as a Trusted Web Activity of www.strynd.com (PWABuilder/Bubblewrap; needs `/.well-known/assetlinks.json` with the Play signing key's SHA-256). Store needs: privacy policy and `/account-deletion` (both live), Data safety form, screenshots, a 1024x500 feature graphic, and a reviewer demo login. Payments decision still open: web-only checkout (hide prices in the Android app; fastest approval), Google Play Billing (15%), or US external payments (enrollment and Google service fees since Oct 2026; rules still shifting). Re-check Google's current policies before building.
- Billing for Apple's App Store: Individual ($9/mo) sold inside the iOS app likely needs Apple in-app purchase; verify the rules before store submission.
- Tabled (bring up again): pick one more Organization-only benefit. Shortlist: Programs & grants (tag clients to funders, Impact split per grant; recommended), Goals & service plans, HMIS-ready export, text appointment reminders, intake forms with consent. Finance features come later for both plans.
- Tabled (bring up again): landing page "For agencies" section with mini previews (Team dashboard, Impact report, Referrals, Activity log; sample data only) and an Organization "Start a 30-day free trial" button.
- Tabled (bring up again): landing page data-ownership and security copy: your data is yours alone, we never sell it, it's encrypted and protected by database-level access rules, and it's deleted when you delete your account (we do store it to run the app, so don't say "we don't keep it").
- Disconnect the unused Neon database from the Vercel project (live data is in Supabase).
