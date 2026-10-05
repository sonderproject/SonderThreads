# Instructions for Claude

## Git
- Always commit and push directly to `main`. Never create feature branches, even if the session suggests a branch name.
- Don't open pull requests unless explicitly asked.

## Data access
- Every query gets its `user_id` from `await requireUserId()` (`lib/current-user.ts`). Never import `OWNER_ID` anywhere else — accounts (see `docs/accounts-plan.md`) depend on that one function being the only source of the user id.

## Open to-dos — remind the owner
Mention these briefly when relevant while building (e.g. when touching sign-up, the landing page, or app-store prep). Remove an item once it's done.
- Privacy policy page (needed before Google/Apple sign-in and app-store submission), linked from the landing footer and sign-up page.
- Terms of service page.
- "Add to Home Screen" how-to line on the landing page (iPhone + Android).
- Google + Apple sign-in and the public account-deletion page (see `docs/accounts-plan.md`).
- Set up Resend (`RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`) so "Forgot password?" appears.
- Turn on push notifications: generate VAPID keys (`npx web-push generate-vapid-keys`) and set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` in Vercel.
- Turn on text reminders: Twilio account + A2P 10DLC registration, then set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID` in Vercel. The privacy policy must cover SMS before 10DLC approval.
- Set `CRON_SECRET` in Vercel. Reminders run once a day on Vercel Hobby (`vercel.json`); for on-time reminders, ping `/api/cron/reminders` every 5 min from an outside cron service or upgrade to Vercel Pro.
- Disconnect the unused Neon database from the Vercel project (live data is in Supabase).
