# Auth setup (Supabase Auth): manual steps and test checklist

Sign-in moved from the app's own code to **Supabase Auth**. Supabase now handles passwords, email confirmation, password reset, 2FA and CAPTCHA. The app's data queries are unchanged: the app's `users.id` is the Supabase user id.

> **Unverified:** the dashboard menu names below are from Supabase's and Cloudflare's dashboards as I know them. I couldn't open their docs from the build environment, so if a label differs slightly, look for the nearest match. The code doesn't depend on the labels.

## Order matters

1. Do section A (env vars) **first**: production sign-in needs them. Without them the sign-in page lists what's missing; no data is affected.
2. Then sections B–E, and **sign in once yourself first** to confirm your existing account migrates with all its data.
3. Do F (CAPTCHA) **last**. Once CAPTCHA is on in Supabase, every sign-in needs a token, so the site key must already be deployed.

---

## A. Vercel environment variables

Go to Vercel → your project → **Settings → Environment Variables**. Set each one for **Production** and **Preview**, then redeploy.

| Variable | Where to find it | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → **Project Settings → Data API** (or **API**) → Project URL | Public. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → **Project Settings → API Keys** → `anon` / publishable key | Public by design. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` also works. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → **Project Settings → API Keys** → `service_role` / secret key | **Server only. Never add a `NEXT_PUBLIC_` prefix.** Used only to migrate old accounts and to delete accounts. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile (section F) | Add this before turning CAPTCHA on in Supabase. |

Vercel's Supabase integration may already have added the first three under these names. If so, check that they exist for Preview too.

The sign-in page lists any missing Supabase variables.

## B. Email confirmation

Supabase → **Authentication → Sign In / Providers → Email**:
- **Enable Email provider:** on
- **Confirm email:** on (usually the default)

Existing accounts aren't affected. They're created in Supabase as already confirmed the first time they sign in after this ships.

## C. Site URL and Redirect URLs

Supabase → **Authentication → URL Configuration**:
- **Site URL:** your production URL, for example `https://www.strynd.com`.
- **Redirect URLs:** add all three:
  - `https://<your-production-domain>/**` and the `www.` version too (`https://www.<your-production-domain>/**`)
  - `https://<project>-*-<team>.vercel.app/**` for preview deployments. Use your project and team slugs from a preview URL. Supabase supports `*` and `**` wildcards.
  - `http://localhost:3000/**`

If a deployment's URL isn't on this list, Supabase falls back to the Site URL and the email link breaks. That's why the preview pattern matters.

## D. Email templates (required)

Supabase → **Authentication → Emails → Templates**. The app verifies email links on the server, so the links must carry a token hash, not Supabase's default link.

**Confirm signup.** Replace the link with:
```html
<h2>Confirm your email</h2>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirm your email address</a></p>
```

**Reset password.** Replace the link with:
```html
<h2>Reset your password</h2>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Set a new password</a></p>
```

**Change email address.** Replace the link with:
```html
<h2>Confirm your new email</h2>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change&next=%2Fsettings%3Femail%3Dconfirmed">Confirm the change to {{ .NewEmail }}</a></p>
```

Links use `{{ .SiteURL }}` so they always point at production and never break. (An earlier version used `{{ .RedirectTo }}`; when the sign-up page's address, e.g. `www.` vs no `www.`, wasn't on the Redirect URLs list, Supabase fell back to the bare Site URL and the link came out as `https://site.com&token_hash=...`, which browsers reject.) Testing sign-up on a preview deployment therefore confirms on production; that's fine.

## E. Custom SMTP (required before real users)

Supabase's built-in email sender is for testing only. It's heavily rate-limited (a few emails per hour) and may only deliver to your project team's addresses. Set up a real sender. Resend works, and it's already on the app's to-do list.

1. **Resend:** add and verify your sending domain, then create an API key.
2. **Supabase → Authentication → Emails → SMTP Settings** (or **Project Settings → Authentication → SMTP**). Enable custom SMTP:
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: your Resend API key
   - Sender email: an address on your verified domain, for example `no-reply@yourdomain`
   - Sender name: `Strynd`
3. **Supabase → Authentication → Rate Limits:** raise the email limit once SMTP is set.

The old `RESEND_API_KEY` / `EMAIL_FROM` variables are no longer used for password reset. Supabase sends that email now.

## F. CAPTCHA: Cloudflare Turnstile (do this last)

1. **Cloudflare dashboard → Turnstile → Add widget.**
   - Hostnames: your production domain, `vercel.app` (covers previews) and `localhost`.
   - Widget mode: **Managed**.
2. Copy the **Site key** into Vercel as `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (section A), then **redeploy**.
3. Supabase → **Authentication → Attack Protection** (also called "Bot and Abuse Protection") → **Enable CAPTCHA protection**:
   - Provider: **Turnstile by Cloudflare**
   - Paste the **Secret key**, then save.

Once enabled, Supabase requires the token on sign-up, sign-in, password reset and resend. All four forms send it. The widget is usually invisible and only asks for a click when traffic looks suspicious.

## G. Two-factor authentication

Supabase → **Authentication → Multi-Factor** (or **MFA**): make sure **TOTP (authenticator app)** is enabled for both enroll and verify. It's normally on by default. Nothing else is needed. Turning 2FA on is optional for each user, in Settings.

## H. Optional: faster session checks

Supabase → **Project Settings → JWT Keys**: migrate to **asymmetric signing keys**. The app checks the session on every request, and with asymmetric keys that check happens locally instead of with a call to Supabase. This is a speed improvement only, not required.

## I. Session timeout

There's no dashboard setting for this. It's `IDLE_TIMEOUT_MINUTES` in `lib/auth.ts` (30), enforced by the app in both the browser and the server.

---

## What users will notice

- **Everyone signs in again once** after this ships, because old sessions aren't carried over.
- **Existing accounts:** the same email and password work, and the account is migrated in the background on that sign-in. You should **sign in first** to confirm your own account and data come through.
- **New accounts** must confirm their email before they can use the app.

---

## Test checklist

Use a real inbox you can open, and a phone with an authenticator app.

**Sign up → confirm → log in**
- [ ] Sign up with a new email. You land on **Check your email**, and the app isn't accessible.
- [ ] Trying to sign in before confirming lands on **Check your email** again.
- [ ] The email arrives from your custom sender. Its link opens the app and signs you in.
- [ ] Sign out, then sign in with email and password. It works.

**Resend confirmation**
- [ ] Sign up with another new email and click **Resend confirmation email**. "Sent again" shows and a second email arrives.
- [ ] Click resend again immediately. "Please wait a minute" shows.
- [ ] The newest link works.

**Existing account (migration)**
- [ ] Sign in with an account created before this change. It works with the old password and all the old data is there.
- [ ] Sign out and back in. It still works (now a normal Supabase account).

**Password reset**
- [ ] Sign in → **Forgot password?** → enter the email. You get the neutral "Check your email" message.
- [ ] The email link opens **Choose a new password**. Mismatched entries are rejected; matching ones save and take you into the app.
- [ ] The old password no longer works and the new one does.
- [ ] An already-used reset link shows "expired or already used".

**2FA: enroll → log out → log in with code**
- [ ] Settings → Two-factor authentication → **Set up**. A QR code and a text key appear.
- [ ] Scan it, enter the code. Status shows **On**. A wrong code is rejected.
- [ ] Sign out and sign in. After the password you get **Enter your code**.
- [ ] A wrong code is rejected. The right code gets you in.
- [ ] While on the code screen, try opening `/people` in another tab. You're sent back to the code step, so no data shows.

**Disable 2FA**
- [ ] Settings → **Turn off**. A wrong code is rejected, a current code turns it off, and status shows **Off**.
- [ ] Sign out and in again. No code is asked for.

**Idle timeout** (to test quickly, temporarily set `IDLE_TIMEOUT_MINUTES = 2`, then change it back)
- [ ] Leave the app untouched past the limit. It signs out to "signed out after … inactivity".
- [ ] With two tabs open, activity in either tab keeps both signed in.
- [ ] Close all tabs, wait past the limit, reopen the app. You're signed out (server backstop).
- [ ] Type slowly in a note for longer than the limit while active. You stay signed in.

**Delete account**
- [ ] Settings → **Delete my account…** → the button stays disabled until DELETE is typed exactly.
- [ ] Confirm. You land on sign-up with "account deleted", and signing in with that email fails.
- [ ] In Supabase → **Authentication → Users**, the user is gone.
- [ ] In the database, that user id has no rows in any table. The SQL check:

  ```sql
  select 'people', count(*) from people where user_id = '<id>'
  union all select 'check_ins', count(*) from check_ins where user_id = '<id>'
  union all select 'notes', count(*) from notes where user_id = '<id>'
  union all select 'users', count(*) from users where id = '<id>';
  ```

  All rows should be `0`.

**CAPTCHA** (after section F)
- [ ] Normal sign-up, sign-in, reset and resend all still work, with no visible challenge most of the time.
- [ ] Bots are blocked. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` to Cloudflare's always-fail test key `2x00000000000000000000AB` in Vercel's Preview environment only and open a preview deployment: sign-in shows "Please complete the security check". Restore the real key afterwards.
- [ ] Supabase → **Authentication → Logs**: requests without a valid token are rejected.
