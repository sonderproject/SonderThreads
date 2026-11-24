import type { Metadata } from "next";
import Link from "next/link";
import { MARKETING_WORDING } from "@/lib/marketing-wording";
import { BrandLockup } from "@/components/BrandLockup";
import { Turnstile } from "@/components/auth/Turnstile";
import { legacyDataUnclaimed, signup } from "@/app/login/actions";
import { TimeZoneInput } from "@/components/notifications/TimeZoneInput";
import { SetupProgress } from "@/components/setup/SetupFrame";
import { setupFlowFor } from "@/lib/setup";
import { cookies } from "next/headers";
import { FRIEND_COOKIE, checkFriendsCode } from "@/lib/friends";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { enabledProviders } from "@/lib/oauth";
import { smsConfigured } from "@/lib/notify/sms";

export const dynamic = "force-dynamic";

// The friends & family version of this page (?friend=...) is never indexed, and its address
// (which holds the code) is never sent to other sites as a referrer.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ friend?: string }>;
}): Promise<Metadata> {
  const { friend } = await searchParams;
  return friend
    ? { robots: { index: false, follow: false }, referrer: "no-referrer" }
    : {};
}

/** The organization agreement, shown with the sign-up consent in the organization set-up (recorded at /setup/org/finish). */
const ORG_CONSENT =
  "I'm also authorized to accept them for my organization, and it has its clients' permission (or another lawful basis) to keep their information in Surfdesk.";

const ERRORS: Record<string, string> = {
  email: "Enter a valid email address.",
  phone: "Enter a valid mobile number.",
  "phone-used":
    "That mobile number is already on another account. Sign in to that account instead.",
  short: "Password must be at least 8 characters.",
  exists: "An account with that email already exists.",
  legacy: "That isn't the current shared password.",
  captcha:
    "The security check didn't go through. Wait a moment for it to finish (a checkbox may appear above the button), then try again.",
  agree:
    "Please agree to the Terms of service and Privacy policy to create an account.",
  weak: "Choose a stronger password.",
  rate: "Too many sign-ups right now. Wait a minute and try again.",
  failed: "Couldn't create the account. Please try again.",
  friend:
    "That invite link isn't valid anymore. Ask the person who sent it for a new one.",
  oauth:
    "Google/Apple sign-up didn't go through. Try again, or use your email.",
  oauth_cancelled: "Sign-up was cancelled. Pick an option to continue.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    next?: string;
    email?: string;
    phone?: string;
    deleted?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    friend?: string;
  }>;
}) {
  const {
    error,
    next,
    email,
    phone,
    deleted,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    friend: friendParam,
  } = await searchParams;
  // Friends & family link (lib/friends.ts): /signup?friend=<code> makes the new account free for life.
  const friendRaw = friendParam || (await cookies()).get(FRIEND_COOKIE)?.value;
  const friend =
    friendRaw && (await checkFriendsCode(friendRaw)) ? friendRaw : null;
  // Which ad brought them (see components/landing/CampaignLinks.tsx); recorded with the sign-up.
  const utm = { utm_source, utm_medium, utm_campaign, utm_content };
  const showLegacy = await legacyDataUnclaimed();
  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";
  // Part of the guided set-up (lib/setup.ts): show where they are in it.
  const flow = setupFlowFor(next);
  const providers = enabledProviders().map((p) => (p === "google" ? "Google" : "Apple"));
  const quick = providers.length > 0;
  // Text reminders aren't live until Twilio is set up: don't ask for a phone number before then.
  const askPhone = smsConfigured();

  return (
    <div
      className={`flex min-h-screen items-start justify-center bg-bg px-4 ${flow ? "pb-16 pt-16 sm:pt-24" : "pt-32"}`}
    >
      <div className={`w-full space-y-3 ${flow ? "max-w-sm" : "max-w-xs"}`}>
        {flow ? (
          <div className="mb-4 space-y-4">
            <SetupProgress flow={flow} step={2} />
            <div className="space-y-1">
              <h1 className="page-title">Create your account</h1>
              <p className="text-sm text-text-muted">
                {flow === "org" ? "You'll be your organization's admin. " : ""}
                {quick
                  ? `One tap with ${providers.join(" or ")}, or use your email.`
                  : "We'll email you a 6-digit code to confirm it's you."}
              </p>
            </div>
          </div>
        ) : (
          <BrandLockup className="mb-2" />
        )}
        {friend && (
          <p className="rounded border border-border p-2 text-xs text-text">
            Friends &amp; family invite: your account is free for life. No card
            needed.
          </p>
        )}
        {deleted && (
          <p className="text-xs text-text-muted">
            Your account and data were deleted.
          </p>
        )}
        {error && (
          <p className="text-xs text-danger">
            {ERRORS[error] ?? "Something went wrong."}
          </p>
        )}
        <OAuthButtons from="signup" next={next} utm={utm} friend={friend} extraConsent={flow === "org" ? ORG_CONSENT : undefined} />
        <form action={signup} className="space-y-3">
          <input type="hidden" name="next" value={next ?? ""} />
          {/* Friends & family: only through the owner's private link, never a visible box (referral discounts will be separate). */}
          {friend && <input type="hidden" name="friend" value={friend} />}
          {Object.entries(utm).map(([k, v]) =>
            v ? (
              <input key={k} type="hidden" name={k} value={v.slice(0, 80)} />
            ) : null,
          )}
          <TimeZoneInput />
          <input
            type="email"
            name="email"
            required
            autoFocus={!quick}
            defaultValue={email ?? ""}
            autoComplete="email"
            placeholder="Email"
            className="input tabular-nums"
          />
          {askPhone && (
            <>
              <input
                type="tel"
                name="phone"
                defaultValue={phone ?? ""}
                autoComplete="tel"
                inputMode="tel"
                placeholder="Mobile number (optional)"
                className="input tabular-nums"
              />
              <label className="flex items-start gap-2 text-xs text-text-muted">
                <input type="checkbox" name="sms_opt_in" className="mt-0.5" />
                <span>
                  Text me task reminders (needs a mobile number). Message &amp;
                  data rates may apply. Reply STOP to opt out, HELP for help.
                </span>
              </label>
            </>
          )}
          <input
            type="password"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Password (8+ characters)"
            className="input tabular-nums"
          />
          {showLegacy && (
            <div className="space-y-1 rounded border border-border p-2">
              <input
                type="password"
                name="legacy"
                autoComplete="off"
                placeholder="Current shared password (optional)"
                className="input tabular-nums"
              />
              <p className="text-xs text-text-muted">
                Enter the app&apos;s current shared password to move all
                existing data into this account. Only works once.
              </p>
            </div>
          )}
          <label className="flex items-start gap-2 text-xs text-text-muted">
            <input type="checkbox" name="agree" required className="mt-0.5" />
            <span>
              I agree to the{" "}
              <Link
                href="/terms"
                target="_blank"
                className="text-accent hover:underline"
              >
                Terms of service
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                target="_blank"
                className="text-accent hover:underline"
              >
                Privacy policy
              </Link>
              , including{" "}
              <Link
                href="/terms#disputes"
                target="_blank"
                className="text-accent hover:underline"
              >
                individual arbitration
              </Link>
              , and I&apos;m at least 18.
            {flow === "org" && <> {ORG_CONSENT}</>}
            </span>
          </label>
          <label className="flex items-start gap-2 text-xs text-text-muted">
            <input type="checkbox" name="marketing_opt_in" className="mt-0.5" />
            <span>{MARKETING_WORDING} (Optional.)</span>
          </label>
          <Turnstile />
          <button
            type="submit"
            className="w-full rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-bg hover:bg-accent-dim"
          >
            Create account
          </button>
          <p className="text-center text-xs text-text-muted">
            Already have an account?{" "}
            <Link href={loginHref} className="text-accent hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
