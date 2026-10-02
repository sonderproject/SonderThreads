# Accounts plan

Status: **email sign-up is live** (steps 1–7, 11, 13). Google, Apple and the public deletion page (steps 8–10, 12) are still to do.
Every query gets its `user_id` from `requireUserId()` in `lib/current-user.ts`,
which looks up the signed-in session.

## Decisions already made

- **Private data per person.** Each account sees only its own people, lists, tasks and notes. No shared workspaces.
- **Open sign-up.** Anyone with the URL can create an account.
- **Email + password is the default.** Google and Apple sign-in are optional extras.
- **Web first.** iOS and Android apps come later, so the sign-in and deletion rules for both app stores are built in from the start.
- **No AI keys involved.** Voice uses the browser's free speech recognition. The OpenAI fallback (`OPENAI_API_KEY`) only matters for iPhone home-screen apps and is unset.

## Build steps

1. **Tables** (added to `lib/db/schema.ts`, self-migrating like everything else):
   - `users`: id, email (unique, case-insensitive), name, password_hash, google_sub, apple_sub.
   - `sessions`: id is a SHA-256 of the token, plus user_id and expires_at.
   - Drop the `user_id` column defaults, so an insert that forgets `user_id` fails instead of landing in the old owner's account.
2. **Sessions.** A random token that works as an httpOnly cookie (web) and as an `Authorization: Bearer` header (native apps). 30-day expiry.
3. **`requireUserId()`** reads the session. With no valid session it redirects to `/login` (pages and actions) or returns 401 (`/api/*`).
4. **Middleware** only checks that a cookie or bearer header is present, because Edge can't query Postgres. The real check happens in `requireUserId()`.
5. **Sign-up and sign-in pages** replace the shared `APP_PASSWORD` gate. Passwords are hashed with Node's built-in `scrypt`.
6. **Keep existing data.** The first sign-up that also enters the current `APP_PASSWORD` is created with id `00000000-0000-0000-0000-000000000001` (today's `OWNER_ID`). All existing rows then belong to that account, and no data moves.
7. **New accounts start empty.** Remove the demo-data seeding (`lib/actions/seed.ts`). This also removes the first-load seed race.
8. **Google sign-in** (`/api/auth/google`): OAuth code flow with a `state` cookie. Exchange the code server-side and read `sub`, `email` and `email_verified` from the ID token. Needs `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. The button is hidden until both are set.
9. **Sign in with Apple** (`/api/auth/apple`): uses `response_mode=form_post`, so the callback is a cross-site POST and the `state` cookie must be `SameSite=None; Secure`. The client secret is an ES256 JWT signed with the `.p8` key. Apple sends the user's name only on the first sign-in. Needs `APPLE_CLIENT_ID` (Services ID), `APPLE_TEAM_ID`, `APPLE_KEY_ID` and `APPLE_PRIVATE_KEY`. The button is hidden until all four are set.
10. **Account linking.** A Google or Apple sign-in whose verified email matches an existing account signs in to that account instead of creating a duplicate.
11. **Account page** (`/account`): shows the email, a sign-out button, and **Delete account**. Deleting removes every row with that `user_id`, then the user (sessions cascade). It runs in one transaction.
12. **Public deletion page** (`/account-deletion`, no sign-in needed): explains how to delete an account. Google Play requires this page.
13. **Isolation test.** Create two accounts and confirm neither can see or change the other's data. Cover pages, the command bar, ⌘K search, both export routes, CSV import and undo/restore.

## App store rules this covers

- **Apple 5.1.1(v)**: an app that supports account creation must let users delete their account and data in-app. Deactivating the account isn't enough.
- **Google Play User Data policy**: requires an in-app deletion path plus a web link where users can request deletion.
- **Apple 4.8**: an iOS app that offers Google sign-in must also offer Sign in with Apple, or an equivalent private login.

## Keys needed (the only manual work)

| Provider | Where | Cost | Env vars |
|---|---|---|---|
| Email/password | none | free | none |
| Google | Google Cloud Console → Credentials → OAuth client ID (Web) | no fee listed by Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Apple | Apple Developer → Identifiers (Services ID) + Keys (Sign in with Apple) | Apple Developer Program, $99/yr | `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` |

Each provider needs its redirect URL registered as `https://<your-domain>/api/auth/<provider>/callback`.

## What users will notice

The shared password stops working. Everyone signs up once. The owner should sign up first, with the old password, so they keep their data.
