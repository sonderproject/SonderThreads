# Command center: plan (agreed Nov 14, 2026, build next session)

Owner-only (`/owner`, behind `requireOwner()`; master account `sonderproject.co@gmail.com`).
Build in this order. Show the owner a short plan per part before building; push each part to `main`.

**Owner-only, airtight (done Nov 14):** `requireOwner()` needs the pinned account id AND the owner
email AND two-step sign-in; everyone else gets a 404. Every new page and action must call it (a test
checks) and log with `logOwnerAction()`. Every control must skip the owner's own account (it can't
be suspended, and maintenance mode never locks it out), and every action also emails the owner a copy.

**Privacy rule for everything here:** the command center shows counts, plans, dates and settings,
never the contents of anyone's client records, notes or tasks (the privacy policy and the
organizations' client-data terms promise that). Account emails and names are fine.

## 1. Controls
- **Suspend an account or organization** (misuse). `users.suspended_at` / `organizations.suspended_at`
  plus a reason. A suspended user can't use the app (`requireUserId` refuses; they see a
  "This account is suspended. Contact support" page), can still read the legal pages, and the
  owner can lift it in one click. Suspending an organization blocks all its members and its
  kiosk and referral link. Every suspend/unsuspend is logged (`logEvent`). Terms already allow it
  ("Ending your account").
- **Maintenance mode** (lock the whole app for updates). One switch with an optional message and
  an end time. Everyone but the owner sees a calm "Down for a quick update, back by 3:00 PM"
  page; landing page, legal pages, Stripe webhook and cron keep working; referral links show
  "temporarily unavailable" instead of erroring. Stored in a one-row settings table, cached for
  ~30 seconds. Optional: schedule it ahead and show a warning banner first.
- **Announcement banner**: a short message every user sees once (dismissible), e.g. "New: Outcomes".
- **Account tools**: search any account or org; extend a trial, make free (comp), resend
  confirmation email, see plan/seats/last active.

## 2. Growth numbers
- MRR (monthly recurring revenue) now and a 90-day trend, trial → paid %, churn % (cancellations
  per month), average revenue per account, from Stripe + `billing_accounts`.
- Health-flagged customer list: every paying account/org with plan, seats, last active, and a red
  flag when nobody has used it for 7+ days (call them before they cancel).

## 3. Understand the audience (counts only)
- Who signs up: individual vs nonprofit vs business, team sizes, solo use (`users.use_case`),
  most common services and outcomes chosen in set-up.
- Activation: % who added 3+ people and logged a check-in in their first 7 days.
- Retention by sign-up week (cohorts): % still active after 1, 2, 4 weeks.
- Feature use: % of accounts using kiosk, referral link, outcomes, voice/AI, calendar sync, PDF reports.
- Where they come from: sign-ups and paid by ad campaign / referral (already tagged), by time zone
  (rough region) and device (phone vs computer).

## 4. Referral growth
- Which organizations have an active referral link, referrals per week, and sign-ups/paid
  accounts from the "Try Surfdesk" note (utm_source=referral).

## 5. Feedback inbox
- Contact-form messages listed in the command center with a "done" checkbox (still emailed too).

## 6. Health checks
- Green/red: last successful email, last Stripe webhook, last cron run, errors in the last 24h,
  database size vs plan limit.

## Growth ideas to offer after (not agreed yet)
- In-app "invite another organization, both get a month free" referral reward.
- One-question satisfaction survey (NPS) after 14 days of use.
- Upgrade nudges: a trial account that hits a limit sees the offer right there.
