# Surfdesk — Product Reference

*What Surfdesk is, everything it does, how it's protected, and what's next. Written from the code as of Nov 26, 2026, not from marketing copy. Keep it current: when a feature ships or changes, update the section it belongs to.*

---

## 1. What Surfdesk is

Surfdesk is an **everyday organizer for people with a lot to keep track of**, with client management built in rather than bolted on. One place holds your tasks, notes, lists, reminders and calendar, plus the people you work with, every visit with them, follow-ups, bookings and the reports that come out of all of it.

The core idea: **you type or say it the way you'd say it out loud, and Surfdesk files it.** "Remind me to call Maria Thursday", "Ana – haircut $45", "Marcus got the job at Amazon", "milk, eggs and bread" each land in the right place (a task, a visit with revenue, a note with an outcome suggestion, a shopping list) without picking a screen first.

It grows with the user:

- **One person** uses it as a personal organizer, plus light client work if they freelance or run a one-person business.
- **A business or nonprofit** adds a team, shared client records, forms, automations, reports, team chat and admin controls.

The same app serves two organization versions that differ only in words and reports:

| | Business version | Nonprofit version |
|---|---|---|
| Visits are called | Visits | Check-ins |
| Report is called | Insights | Impact |
| Report shows | Revenue from service prices | Demographics for funders and boards |
| Leaving client | "Mark as former customer" | "Exit from program" / "Re-enroll" |

Individuals see "Meetings" and "Insights".

**Who it's for:** busy professionals, freelancers and solo business owners, any business with repeat customers (salons, spas, gyms, coaches, trainers, clinics, contractors and trades, consultants, agencies), and nonprofits running programs.

**The problem it solves:** people juggle a notes app, a reminders app, a calendar, a spreadsheet of clients and a group text. Things fall through the cracks (missed follow-ups, lost notes, hand-counted reports). Surfdesk replaces that stack with one place that understands plain sentences.

---

## 2. Plans, pricing and trials

| Plan | Price | Who | Trial |
|---|---|---|---|
| **Individual** | $9/month | One person | 7 days, **no card needed** |
| **Business** | $19 per person/month, 1–18 people | Any organization, including a business of one | 14 days with a card |
| **Organization** | $349/month with 20 seats included, $15 per extra seat | 19 people or more | 14 days with a card |
| **Enterprise** | Custom | Large organizations | Talk to us |

- **Skip the trial**: 30% off the first month.
- **Cancel flow**: a one-time optional "$5 for 2 months" offer before cancelling.
- **One trial per card, ever**, and one account per mobile number (stored as a hash), so trials can't be farmed.
- **Trial without a card**: imports are capped at 25 people and backup restores are locked until a card is added, so a trial can't be reset by export → new account → import. Exports are never limited.
- **Friends & family link**: a private sign-up link makes accounts free for life (capped at 25, guess-protected, every use emailed to the owner).
- Billing runs on Stripe (live). Payment failures send an email; the webhook is monitored on the owner Health page.

**What Business adds over Individual:** smart forms, custom automations, the reports dashboard and scheduled report emails, branded PDF reports, outcomes, custom fields, referrals, team, roles and team chat. Individuals never see locked tabs for these. The pages simply don't exist for them, and anything they saved comes back if they upgrade.

---

## 3. The core organizer (every account)

### Home
- A day view: today's tasks, a mini calendar, people who need attention, recent people and notes.
- A sky card with current weather and sunrise/sunset (approximate location, no permission prompt).
- A three-step "Getting started" checklist for new accounts (add a person, log a visit, then invite a teammate or write a note). It ticks itself off from real data and can be hidden.

### The command box (type or say it)
- One box on every page (⌘K / Ctrl+K, or the phone's add button) that understands plain sentences:
  - **Tasks and reminders** with dates and times ("call Jasmine Friday at 3"), including recurring ones.
  - **Notes**, attached to a person when one is named.
  - **People**: "add Marcus Johnson 555-0100".
  - **Visits with a service and price**: "Ana – haircut", "Marcus bought catering $200", "Jo had a consultation yesterday". These are deliberately strict so they never guess wrong.
  - **Lists**: "add milk and eggs to groceries".
  - **Updates** to a person's status, and **search** across everything.
  - Several commands in one sentence (a batch).
- **Outcome suggestions**: "Marcus got the job at Amazon" suggests the "Got a job" outcome; the person confirms with one tap, and nothing is recorded automatically.
- **AI is optional.** With OpenAI or Anthropic configured it reads messier sentences. If the AI is down or not set up, a built-in parser takes over silently, so the product works with zero AI.
- **Voice**: dictate into the box (phone and computer). iPhone voice goes through OpenAI transcription, with per-user caps.
- **Android share sheet**: share text from any app into Surfdesk and it lands in the command box.
- Forgiving search everywhere: partial words, typos and word starts all match.

### Tasks
- Due dates and times, recurring tasks (the next one is always in the future, even if you complete a task weeks late), linked to a person or list.
- **Always private to their owner**, even inside an organization. Managers and Admins never read another person's tasks; organization reports can only count them.

### Notes
- Free-text notes, optionally attached to a person, with categories.
- Notes about a person feed an **AI summary** on their profile (short summary plus current status and next step), regenerated in the background.
- Text boxes grow as you type. Optional spell check and conservative autocorrect (off by default; never touches names, emails, links or numbers).

### Lists
- Simple checklists (groceries, packing) and **group lists** of people (a cohort, a class, a team).
- Export a list as PDF or Excel, share it from a phone, or email everyone on a group list through your own email app.
- "Add to People" turns list items into person profiles (name, birthday and phone split out).

### Calendar
- Month view of tasks, birthdays and appointments.
- **Link outside calendars** (Google, Apple, Outlook, Calendly, Cal.com) by private .ics link; they show alongside Surfdesk items.
- **Subscribe to Surfdesk from your phone's calendar**: a private feed link puts your tasks into Google or Apple Calendar.

### People
- A profile per person: contact details, birthday, status, next step, summary, history (every visit, note, task and outcome), services they've had, custom fields (Business), outcomes and exits.
- "Needs attention" flags people you haven't contacted in a while.
- **Import a client list** from Excel or CSV. A value is only saved if it's certain to be right (a 7-digit phone or a date like 13/45 is left blank rather than guessed). Imports can be undone.
- **Exits**: mark someone as a former customer or exited from a program, with a reason grouped as positive, neutral or unplanned. History stays, they can come back, and reports count exits by reason.
- **Sample data**: an empty account can load 12 sample people with a month of visits to explore, then remove them in one click.

### Visits / Meetings / Check-ins
- Log who came, when, and which service. The service's price becomes the amount (revenue).
- The first time someone logs a service with no price, the form asks "What do you usually charge?" and saves it as the price, so nobody types prices during sign-up.
- The last-used service is remembered on each device, for front desks logging the same thing all day.

### Services and revenue
- A list of what you offer, with optional prices. Feeds visit logging and revenue on reports. Organizations get a starter list from their line of work at sign-up.

### Booking link
- A public page (`/book/<code>`) where anyone can pick a time. Only free times are offered: not already booked and not overlapping your timed tasks. Each booking finds or adds the person and puts the appointment on your task list.

### Reminders and notifications
- In-app notifications, email, and (once switched on) phone push alerts and text reminders.
- **Quiet hours** in your own time zone (e.g. 9 PM–7 AM): nothing pings you then.
- Phone alerts never include message text or client details.

### Insights (individuals' report)
- People served, new vs returning, visits per person, busiest times, services, revenue or value of services, exits. Clear numbers from what you already logged.

### Simple follow-ups (Settings → Automations)
- On/off switches that create follow-up tasks for you (e.g. "no contact in 30 days"). Each makes at most a few tasks a day and never repeats itself.

### Your data
- Export everything as a backup file or one spreadsheet per kind of record. Restore a backup (restoring the same file twice adds nothing). Clear your data or delete your account (also from a public `/account-deletion` page).

---

## 4. Business tools (organizations)

### Team, roles and invites
- Three roles, shown as **Admin**, **Manager** and **Member**:
  - **Admin** runs the organization: staff, roles, billing, settings, exports.
  - **Manager** sees every client and every member's work (read-only on others' clients) and builds forms, automations and reports. Never sees anyone's tasks or private contacts.
  - **Member** works their assigned clients.
- Invite by email, in bulk, or with a **team join link** limited to your email domain.
- Reassign one client or all of a person's clients; deactivate staff when they leave (their clients are handed over first).
- **Team view**: each member's month (their tasks show only as "Busy" with a time, never titles), their clients and recent work.
- **Activity log**: who added, changed, deleted, reassigned, viewed or exported client records, newest first.
- A "Finish setting up" checklist for new organizations.

### Member data rules (on by owner's decision, Nov 24, 2026)
- A Member's login belongs to the organization. Two Admin switches, **both off by default**:
  - **"Members can download data."** When off, every download and export is blocked for Members, on the server and in the interface.
  - **"Members can keep private contacts."** When off, every client a Member adds belongs to the organization, and a Member can't pull a client out to private. The database itself enforces this.
- Members who want their own data are pointed to a separate Individual account.

### Admin "Export everything"
- Admins download every client, visit, note, outcome, exit, service, custom field and form response the organization owns, as one file or one spreadsheet per table, with the staff member each record belongs to.
- Never includes Members' private contacts, tasks or team chats. Every download is written to the activity log.

### Team messages
- Channels (#general always exists; Admins and Managers create, rename, archive and set who can post), private group chats and direct chats.
- Tag a client (`#`) or a teammate (`@`); share a task (as a copy) or a note into a chat.
- **Admins can never read chats they're not in**; they can only delete them.
- Client tags are written to the activity log. Phone alerts never show message text.
- Load-tested with 300 members and 60,000 messages.

### Smart forms
- A builder with 15 field types and ready-made templates per audience (never asks for SSN, medical or ID numbers; a test enforces it).
- Share by **link or QR code** (no embedding on other sites).
- **Intake**: responses can wait for staff review, auto-create a new profile when no match exists, or do nothing. An existing profile is never overwritten; a match gets a note instead.
- Admins and Managers see every response; Members see only responses assigned to them. Answers never appear in URLs, analytics, logs or notifications.
- Spam protection: hidden bot trap, minimum fill time, per-network and per-form daily caps. Old responses are purged on a retention schedule.

### Custom automations (When → If → Then)
- **Triggers**: a form response, a person added, a person exited, a visit logged, no contact for N days, a birthday, a custom date field.
- **Actions** stay inside the app: create a task, send an in-app alert, add a note, set a custom field, flag for follow-up, add to a list, assign a person or response, change a response's status.
- Deliberately **no** actions that email or text outsiders, delete anything, change roles or billing, or call outside services.
- Every rule runs once per event, never triggers other rules, skips exited people and is capped (100 runs per rule a day, 300 actions per account a day). "Test this rule" previews what it would do. Organization runs go in the activity log.

### Reports
- **Impact / Insights**: the full report and branded PDF (with your logo). Nonprofits get demographics; businesses get revenue.
- **Dashboard**: each Admin or Manager picks their own tiles, filtered by member, service or program and date range.
- **Scheduled report emails**: weekly or monthly at a chosen hour, only to the schedule's owner or the organization's Admins and Managers (there's no field for an outside address). Emails contain counts only, never names or notes. A failed send retries once, then alerts the owner.

### Outcomes and custom fields
- Outcomes: results people reach (e.g. "Found housing", "Got a job"), recorded per person and counted in reports.
- Custom fields: extra details tracked on every profile, set up by Admins.

### Referrals
- A public referral link for partner agencies, with open hours and time slots. Admins are notified when a referral arrives, then accept, match to an existing client or decline. Exportable for Admins.

### Front-desk kiosk
- A tablet at the front desk where clients check themselves in. The kiosk stays signed in as staff but can only run kiosk actions. Even with browser developer tools, it can't search, export or edit anything else.

### Bring in clients
- A member who used Surfdesk on their own can move existing clients into the organization.

---

## 5. Getting people in: sign-up and friction work

Every step a new person takes was designed to remove effort without losing commitment.

- **Homepage** (thesurfdesk.app):
  - A **live "Try it right now" box** runs the real command parser on sample data before sign-up. Whatever they type carries into their account afterwards.
  - The app's real report charts with sample data, team chat, a "Why Surfdesk" section and real customer quotes.
  - Pricing within ~5 desktop screens, and a "Talk to us" path for organizations.
- **Audience pages**: `/individuals`, `/business`, `/nonprofits`, plus comparison and template pages for search traffic.
- **"Who is Surfdesk for?"**: Just me or My team.
  - **Individuals: 3 steps.** Account → verify email → first person. No questions before the account.
  - **Organizations: 6 steps.**
    - Step 1 (name, type, line of work, team size) is one page. The line of work loads matching services automatically, with no prices needed.
    - Then account → verify email → start trial → invite team (skippable) → bring in clients (skippable).
- **Google sign-in** (live, brand-verified so Google's screen shows "Surfdesk" and the logo): one tap, no email confirmation because Google already verified the address. Apple sign-in is built and waiting on setup.
- **Consent in one line**: the Terms (including individual arbitration) and, for organizations, the authority-to-agree statement sit under the sign-in buttons or in the single checkbox. No extra agreement page.
- **No phone number asked** until text reminders are actually live.
- **Price on first visit** instead of during sign-up; the getting-started checklist and sample data turn effort into small wins.
- **Lifecycle emails** (through Resend): welcome, a day-3 tip that fits how they use it (paused until a mailing address is set), trial ending, trial ended (data still there), payment failed.
- **Attribution**: every sign-up and paid conversion is tracked per landing page and ad campaign, so the owner sees which page brings paying customers.

---

## 6. Security and privacy

### Sign-in and sessions
- Supabase Auth with **Cloudflare Turnstile** bot protection on sign-up, sign-in and password reset. A rate-limited server fallback keeps people able to sign in if the check fails.
- Email confirmation for password sign-ups (prevents someone claiming an email they don't own). Google sign-in is provider-verified.
- **Two-step sign-in** (authenticator app), required for the owner command center.
- **Staying signed in**: individual accounts stay signed in until they sign out, for up to 30 days, then sign in again. Organization members auto-lock after 30 minutes idle by default (shared computers, client data). Anyone can change their own setting; "sign out everywhere" is one tap.
- Rate limits on every sensitive path: sign-in tries per email and per network, sign-ups per network, invite and friends-code guessing.

### Data walls
- **Every account is walled off in the database** (46 row-level security policies): a person can only reach their own records, plus their organization's shared client records if they're an active member.
- **Tasks are private to their owner**, always. Reports only count them.
- **Members' private contacts** (when allowed) never join the organization.
- **Managers** see client work read-only and never personal records.
- **Admins** can't read chats they're not in.
- Every query gets the user id from one function, so no code path can act as someone else.
- The **owner command center** requires the owner's email AND permanent account id AND two-step sign-in; everyone else gets a "not found" page. The owner's own account can never be suspended or locked out by owner controls.

### What never leaves the app
- Phone alerts, scheduled report emails and in-app automation alerts never include client names, notes or message text.
- Form answers never go in URLs, analytics, logs or notifications.
- Automations can't email or text outsiders.
- Marketing analytics run only on public marketing pages, never inside the app.

### Web protections
- No embedding in other sites (X-Frame-Options DENY, frame-ancestors none), strict HTTPS (HSTS), a strict referrer policy, and a permissions policy that allows only the microphone (for voice).
- **Outside calendar links** are fetched safely: only public HTTPS servers, every address re-checked at connect time, redirects re-checked, size and time capped.
- The **kiosk** can only run kiosk actions.

### Audit and monitoring
- **Activity log** per organization (adds, changes, deletes, reassignments, profile views, client tags in chat, exports, automation runs).
- **Owner event log** and email alerts for anything unusual: sign-in check failures, usage caps hit, friends link used, server errors (captured automatically).
- **Per-user usage caps** on paid services (AI parsing, AI summaries, voice, texts, exports) so no one can run up costs; the owner is alerted when a cap is hit.

### Privacy and legal
- Data is never sold, and AI providers don't train on it (stated in the privacy policy).
- Terms and privacy policy are versioned. Every agreement is recorded with version, time, network and browser, and a material change asks everyone to agree again.
- Marketing emails are opt-in only, with the exact wording recorded for each choice, and paused until a mailing address is set (US law).
- A public account-deletion page exists (required by app stores).

---

## 7. The owner command center

Private to the owner (see Security). Counts only, never client records.

- **Overview**: sign-ups, money and problems across all of Surfdesk, including the sign-up funnel step by step.
- **Accounts**: suspend, extend a trial, grant free-for-life.
- **Controls**: maintenance mode and a site-wide announcement.
- **Growth**: money in, conversion, churn, customers at risk of leaving, what referral links and each landing page bring in, and the marketing list.
- **Audience**: who signs up, who sticks around, and which features they use.
- **Inbox**: support messages from inside the app and "Talk to us" requests from organizations, with a check-off when handled.
- **Health**: last email sent, last Stripe webhook, last background job run, push and text status, and other setup checks.
- Every owner action is logged and emailed to the owner.

---

## 8. What people can use it for

- **Busy professional:** "Remind me to send the proposal Friday at 10", a running grocery list, notes from calls, the dentist appointment next to their Google Calendar. One place instead of five apps.
- **Freelancer or consultant (Individual):** clients with history, a booking link instead of email back-and-forth, follow-up reminders, revenue from logged sessions, and a monthly Insights view.
- **Salon, spa, barber:** front desk logs "Ana – haircut" in a second. Prices become revenue, regulars vs new customers are tracked, staff share the client list, and the owner sees busiest times.
- **Gym, trainer, coach:** sessions and classes per client, "no contact in 30 days" follow-ups, intake forms by QR code, team chat about clients.
- **Clinic or wellness practice:** visit history per client, intake forms that create profiles after review, roles so staff only see what they should, an activity log of who viewed what.
- **Contractor or trades:** estimates, service calls and repairs as services, follow-up tasks after a job, booking link for estimates.
- **Agency or creative studio:** clients and projects, team chat linked to clients, forms for new client briefs, reports by service.
- **Nonprofit program:** check-ins per participant, referrals from partner agencies, outcomes ("found housing") and exits, demographics, a funder-ready Impact PDF and scheduled monthly report emails to leadership. A front-desk kiosk for self check-in. Members' logins stay under the organization's control.

---

## 9. Status: live, waiting on setup, planned

**Live:**
- Everything in sections 3–7.
- Google sign-in (brand-verified).
- Billing (Stripe live).
- Lifecycle emails (except the day-3 tip).
- support@thesurfdesk.app forwarding.

**Built, waiting on setup:**
- **Push notifications**: needs VAPID keys in Vercel.
- **Text reminders**: needs a Twilio account and carrier (10DLC) registration.
- **Apple sign-in**: needs the Apple Developer Program ($99/yr); its secret expires every 6 months.
- **Day-3 tip email**: needs a mailing address set.

**Planned / recommended next:**
- **Programs & grants** (recommended next Business feature): tag clients and visits to funders or programs; Impact, dashboard and scheduled reports split by program; businesses use it as service lines or locations.
- Other Business ideas: goals and service plans, HMIS-ready export, intake forms with signatures, text appointment reminders.
- Trial emails based on what each user did.
- A real 15-second homepage demo recording.
- Finance features (later, both plans).
- Google Play app after the LLC forms (January); App Store rules to check for in-app billing.

---

## 10. Open owner to-dos

- **Rotate the keys pasted in chat:** Stripe live secret, Resend key (and the Supabase SMTP password), and delete the Supabase setup token. Also delete the disabled old Stripe webhook.
- Set **`POSTAL_ADDRESS`** in Vercel (turns the day-3 tip email back on).
- **Turn on push notifications** (VAPID keys).
- **One real test purchase** each of Individual and Business, then refund.
- **Lawyer review** of `/terms` and `/privacy`, including the one-line consent under sign-in, the organization consent wording, the "Talk to us" form, the cancel offer and California auto-renewal rules.
- **Trademark** "Surfdesk" (USPTO classes 9 and 42), ideally in the LLC's name; file a California DBA for "Sonder Project" if trading under it before January.
- Vercel spend management and a firewall rate-limit rule; OpenAI/Anthropic monthly spend limits.
- Update the legal name when the LLC forms.

---

## 11. Where things live (for builders)

| Area | Code |
|---|---|
| Plans and gating | `lib/plan.ts`, `lib/pricing.ts`, `lib/billing.ts` |
| Words per account type | `lib/terms.ts` |
| Command box | `lib/actions/command.ts`, `lib/ai/*`, `lib/service-command.ts`, `lib/outcome-match.ts`, `lib/try-it.ts` |
| Sign-up flow | `lib/setup.ts`, `lib/actions/setup.ts`, `app/get-started/*`, `app/setup/*`, `app/signup`, `app/auth/*`, `lib/oauth.ts` |
| Member data rules | `lib/member-policy*.ts`, `app/(app)/organization` |
| Exports | `lib/export/backup.ts`, `lib/export/org-export.ts`, `app/api/*/export` |
| Forms / automations / reports | `lib/forms*.ts`, `lib/workflows*.ts`, `lib/dashboard*.ts`, `lib/reports*.ts` |
| Messages | `lib/messages.ts`, `lib/actions/messages.ts` |
| Security | `lib/session.ts`, `lib/current-user.ts`, `lib/owner.ts`, `lib/kiosk-guard.ts`, `lib/calendar-fetch.ts`, `lib/db/schema.ts` (row-level security), `next.config.mjs` (headers) |
| Usage caps | `lib/usage.ts` |
| Owner command center | `app/(app)/owner/*`, `lib/events.ts`, `lib/funnel-stats.ts` |
| Design system | `docs/DESIGN.md`, `app/globals.css` |
| Rules for building | `CLAUDE.md` |
| Database tests | `scripts/db-tests/*` (exits, forms, workflows, reports, backups, member rules, organization export) |
