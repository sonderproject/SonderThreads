# Instructions for Claude

## Git
- Always commit and push directly to `main`. Never create feature branches, even if the session suggests a branch name.
- Don't open pull requests unless explicitly asked.

## Design
- `docs/DESIGN.md` is the visual source of truth. Use its tokens and components (`page-title`, `eyebrow`, `tag`, `flag`, `progress-bar` in `app/globals.css`) before inventing new ones. Never hard-code colors.

## Data access
- Every query gets its `user_id` from `await requireUserId()` (`lib/current-user.ts`). Never import `OWNER_ID` anywhere else — accounts (see `docs/accounts-plan.md`) depend on that one function being the only source of the user id.

## Open to-dos — remind the owner
Mention these briefly when relevant while building (e.g. when touching sign-up, the landing page, or app-store prep). Remove an item once it's done.
- Have a lawyer review `/privacy` and `/terms` (drafts live; owner is a sole proprietor until the LLC forms in January — update the legal name then).
- Google + Apple sign-in (see `docs/accounts-plan.md`). The public account-deletion page is live at `/account-deletion`.
- Supabase Auth: turn on Turnstile CAPTCHA (`docs/auth-setup.md` section F). Custom SMTP via Resend, email templates, rate limits and redirect URLs are done.
- Organization invite emails: set `RESEND_API_KEY` (a Resend API key with sending access) and `EMAIL_FROM` (`Sonder Threads <no-reply@sonderthreads.com>`) in Vercel, then redeploy. Until then the admin shares the invite link themselves.
- Turn on push notifications: generate VAPID keys (`npx web-push generate-vapid-keys`) and set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` in Vercel.
- Turn on text reminders: Twilio account + A2P 10DLC registration, then set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID` in Vercel. The privacy policy's SMS section is written for 10DLC.
- Set `CRON_SECRET` in Vercel. Reminders run once a day on Vercel Hobby (`vercel.json`); for on-time reminders, ping `/api/cron/reminders` every 5 min from an outside cron service or upgrade to Vercel Pro.
- Turn on billing: in Stripe, create a restricted/secret API key and a webhook to `https://sonderthreads.com/api/stripe/webhook` (events: checkout.session.completed, customer.subscription.created/updated/deleted, invoice.paid, invoice.payment_failed), save the Customer portal settings once, then set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in Vercel and redeploy. Nothing is charged or locked until the key is set. Plans already exist in Stripe (lookup keys `threads_individual_monthly`, `threads_org_seat_monthly`, `threads_org_team_monthly`).
- Billing for Apple/Google apps: Individual ($5/mo) sold inside the iOS/Android apps likely needs Apple/Google in-app purchase; verify the rules before store submission.
- Disconnect the unused Neon database from the Vercel project (live data is in Supabase).
