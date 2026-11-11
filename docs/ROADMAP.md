# Roadmap

Strynd (formerly Sonder Threads; branded "Strynd by Sonder Project"): a client tracker and personal organizer. Backend: Supabase/Postgres.

## What we're building toward

- **Product:** a general-purpose organizer anyone can use (tasks, notes, voice notes, planning) plus client tracking (client profiles, services, follow-ups, referrals).
- **First market:** nonprofit and social services teams that must use HMIS. HMIS is the *system of record*; Strynd is the *system of work*, the daily tool that makes HMIS entry a quick batch job. Strynd complements HMIS and never replaces it.
- **Business model:** organizations pay per user per month. Individuals can also use it solo.
- **Deadlines:** app store submission by **Nov 20, 2026**. Conference pitch to organizations on **Dec 9, 2026**.

## Plans: one app, two tiers

One app and one codebase for everyone. No separate app or repo.

- **Free (individuals):** the full personal organizer and client tracker. Solo users never see organization features (no Team tab, roles or invites).
- **Organization (per seat per month):** everything in Free, plus org-only features that appear only for members of an organization, based on the organization's `plan`.

Org-only features (later phases):
- Team tab, caseload overview, client reassignment (Phase 4)
- Audit log of who viewed or changed each client record (Phase 4)
- Team-wide funder and outcome reports, rolling up today's personal metrics
- HMIS-ready export
- Admin controls: require 2FA, block "Stay signed in", set auto-lock, deactivate staff
- Shared templates (intake, referrals, resources)
- Later: SSO, priority support, and a dedicated database for large contracts

Growth path: a case manager uses Free, then brings it to their agency, which buys seats. In one app, moving their clients into the agency is a button.

## Data we store (and don't)

- **Client profiles:** name, DOB, phone, email, gender, income level, ethnicity.
- **Never:** SSNs, government ID numbers, financial account info.
- This is still sensitive personal data, so security is a hard requirement: RLS on every table, nothing sensitive stored on the device, and the service role key never in the client.

## Core privacy rule (all phases)

- A record attached to a client (has a client id) belongs to the **organization**. Supervisors can see it.
- A record **not** attached to a client (personal tasks, personal notes, voice notes saved to "my notes") belongs only to the **user**. Nobody else can ever see it, including supervisors and admins.

## How we work

- One phase at a time, all on `main` (see `CLAUDE.md`), with a commit after each item. The owner tests and approves before the next phase starts.
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
- [ ] Sign-up CAPTCHA via Supabase's built-in support (Cloudflare Turnstile). *(Code built, switched off. Deferred by the owner: turn on later via `docs/auth-setup.md` section F.)*

## Phase 2: Settings tab

Every option is a preset or toggle stored in a `user_settings` table (one row per user; RLS so users see only their own). Users can't break the layout: no free-form styling.

Built (awaiting test):
- [ ] **Account:** name, email change, phone, change password, 2FA on/off, sign out of all devices, delete account
- [ ] **Notifications:** push on/off, follow-up reminder timing, daily summary time, quiet hours
- [ ] **Privacy & security:** auto-lock timeout. Face ID/fingerprint shows "Coming with the mobile app".
- [ ] **Data:** export my data (CSV)
- [ ] **About:** app version, privacy policy, terms, contact support

Deferred by the owner (add later):
- Profile photo
- **Appearance:** theme, accent color (6 presets), text size, density, start screen, date format, week starts on
- **Notes:** default save location for voice notes

## Phase 3: Organization layer (highest risk: touches every table)

- `organizations` table; `memberships` table (user_id, org_id, role).
- Roles: admin, supervisor, case_manager.
- `org_id` on every client-related table. Personal (non-client) records stay user-owned.
- RLS on every table enforcing the core privacy rule, at the database level, never only in the UI.
- Admin invite flow: invite staff by email; invited users join that org. Solo sign-up still works.
- Admins can deactivate users and reassign their clients.
- Test with two fake orgs: neither sees the other's data, and supervisors can't see anyone's personal records.
- Back up the database before running migrations. *(Done 2026-11-09: every table, plus Supabase's auth users, copied to the `backup_20261109` schema with row counts verified. The Supabase project is on the free plan, which has no automatic backups.)*
- Data safety: changes only add tables and columns. No existing row is moved or deleted. Existing accounts stay solo until they create or join an org.
- Database-enforced privacy goes behind one Vercel setting that can switch back to today's behavior instantly.
- Built (awaiting test): Settings → "Set up an organization" (only link solo users see); /organization for admins (staff, roles, invite links, deactivate with client handover, reactivate, rename); /join/<token> invite links (one-time, 14 days, must match the invited email); /organization/clients to bring existing clients in. Deleting an account hands that member's organization clients to another admin (or asks for one first). Invites are links the admin sends; automated invite emails can come later.
- Decisions (owner can change): when joining an org, a member picks which existing clients move in; case managers see only their own clients; lists stay personal (client entries on them are org data).

## Phase 4: Supervisor layer

- **Team tab** (supervisors and admins only): each staff member with client count, open follow-ups and overdue items.
- Click a person to see their client list, read-only.
- Click a client to see the full profile with everything attached (services, notes, voice notes, tasks), read-only.
- **Actions:** reassign a client to another staff member; leave a comment on a client.
- **Audit log:** Postgres triggers record who created, updated or deleted client records, and each time a supervisor views a client profile.
- Supervisors never see personal (non-client) records.

Built (awaiting test): Team tab (admins and supervisors only) with per-staff client counts, follow-ups, open and overdue tasks; read-only caseload and client views; reassign a client (supervisors and admins); supervisor comments (case manager notified, sees them on the client page); audit log written by database triggers (create/change/delete/reassign/comment, field names only) plus views of client records, readable by admins at Team → Activity log. Covered by `scripts/db-tests/orgs.test.ts` (53 checks).

## Later (not now)

HMIS-ready export, Stripe billing, SSO, per-org custom templates.
