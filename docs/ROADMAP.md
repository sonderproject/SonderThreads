# Roadmap

Sonder Threads (working name; branded "<name> by Sonder Project"): a client tracker and personal organizer. Backend: Supabase/Postgres.

## What we're building toward

- **Product:** a general-purpose organizer anyone can use (tasks, notes, voice notes, planning) plus client tracking (client profiles, services, follow-ups, referrals).
- **First market:** nonprofit and social services teams that must use HMIS. HMIS is the *system of record*; Threads is the *system of work*, the daily tool that makes HMIS entry a quick batch job. Threads complements HMIS and never replaces it.
- **Business model:** organizations pay per user per month. Individuals can also use it solo.
- **Deadlines:** app store submission by **Nov 20, 2026**. Conference pitch to organizations on **Dec 9, 2026**.

## Data we store (and don't)

- **Client profiles:** name, DOB, phone, email, gender, income level, ethnicity.
- **Never:** SSNs, government ID numbers, financial account info.
- This is still sensitive personal data, so security is a hard requirement: RLS on every table, nothing sensitive stored on the device, and the service role key never in the client.

## Core privacy rule (all phases)

- A record attached to a client (has a client id) belongs to the **organization**. Supervisors can see it.
- A record **not** attached to a client (personal tasks, personal notes, voice notes saved to "my notes") belongs only to the **user**. Nobody else can ever see it, including supervisors and admins.

## How we work

- One phase at a time. Each phase gets its own git branch, with a commit after each item. The owner tests and approves before the next phase starts.
- Use Supabase built-ins wherever they exist. Don't hand-roll auth or security.
- Do only what the current phase asks: no unrelated refactors.
- Keep the UI consistent with the existing design (`docs/DESIGN.md`).
- List every manual step (Supabase dashboard, CAPTCHA keys, redirect URLs) exactly: what and where.
- End each phase with a test checklist.

---

## Phase 1: Auth hardening

- [x] Email confirmation
- [x] Password reset
- [ ] 2FA with Supabase Auth MFA (TOTP): enroll with a QR code, a code step at sign-in when it's on, and turning it off requires a current code. Optional per user. *(Built; awaiting test.)*
- [ ] Session timeout: auto sign-out after 30 minutes idle (one constant, a setting later). *(Built; awaiting test.)*
- [ ] In-app account deletion that removes all the user's data, with a confirmation step, run server-side. The service role key never reaches the client. *(Built; awaiting test.)*
- [ ] Sign-up CAPTCHA via Supabase's built-in support (Cloudflare Turnstile). *(Code built; Cloudflare and Supabase setup still to do, see `docs/auth-setup.md` section F.)*

## Phase 2: Settings tab

Every option is a preset or toggle stored in a `user_settings` table (one row per user; RLS so users see only their own). Users can't break the layout: no free-form styling.

- **Account:** name and photo, email, phone, change password, 2FA on/off, sign out of all devices, delete account
- **Appearance:** theme (light/dark/system), accent color (6 presets), text size (S/M/L), density (comfortable/compact), start screen (Today/Clients/Tasks), date format, week starts on
- **Notifications:** push on/off, follow-up reminder timing, daily summary time, quiet hours
- **Notes:** default save location for voice notes ("ask each time" or "my notes")
- **Privacy & security:** auto-lock timeout, Face ID/fingerprint unlock (mobile)
- **Data:** export my data (CSV)
- **About:** app version, privacy policy, terms, contact support

## Phase 3: Organization layer (highest risk: touches every table)

- `organizations` table; `memberships` table (user_id, org_id, role).
- Roles: admin, supervisor, case_manager.
- `org_id` on every client-related table. Personal (non-client) records stay user-owned.
- RLS on every table enforcing the core privacy rule, at the database level, never only in the UI.
- Admin invite flow: invite staff by email; invited users join that org. Solo sign-up still works.
- Admins can deactivate users and reassign their clients.
- Test with two fake orgs: neither sees the other's data, and supervisors can't see anyone's personal records.
- Back up the database before running migrations.

## Phase 4: Supervisor layer

- **Team tab** (supervisors and admins only): each staff member with client count, open follow-ups and overdue items.
- Click a person to see their client list, read-only.
- Click a client to see the full profile with everything attached (services, notes, voice notes, tasks), read-only.
- **Actions:** reassign a client to another staff member; leave a comment on a client.
- **Audit log:** Postgres triggers record who created, updated or deleted client records, and each time a supervisor views a client profile.
- Supervisors never see personal (non-client) records.

## Later (not now)

HMIS-ready export, Stripe billing, SSO, per-org custom templates.
