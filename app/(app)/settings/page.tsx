import { TwoFactorCard } from "@/components/settings/TwoFactorCard";
import { DeleteAccountCard } from "@/components/settings/DeleteAccountCard";
import { ChangePasswordCard } from "@/components/settings/ChangePasswordCard";
import { PushToggle } from "@/components/notifications/PushToggle";
import { TimeZoneInput } from "@/components/notifications/TimeZoneInput";
import { requireUserId } from "@/lib/current-user";
import { queryOne } from "@/lib/db/client";
import { logout, requestEmailChange, signOutEverywhere } from "@/app/login/actions";
import { saveProfile } from "@/lib/actions/profile";
import { getNotificationSettings, saveContactSettings, sendTestNotification } from "@/lib/actions/notifications";
import { formatPhone } from "@/lib/notify/phone";

/** Settings: account, notifications, security and data, in one place (was Account + Settings). */
const EMAIL_ERRORS: Record<string, string> = {
  "email-invalid": "Enter a valid email address.",
  "email-same": "That's already your email.",
  "email-taken": "Another account already uses that email.",
  "email-rate": "Too many emails sent. Try again in a little while.",
  "email-failed": "Couldn't start the change. Try again.",
};

const buttonClass = "rounded border border-border px-3 py-1.5 text-sm font-medium text-text hover:bg-bg-hover";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; email?: string }>;
}) {
  const { error, saved, email } = await searchParams;
  const userId = await requireUserId();
  const [user, notify] = await Promise.all([
    queryOne<{ email: string; name: string | null; phone: string | null; mfa_enabled: boolean }>(
      `select email, name, phone, mfa_enabled from users where id = $1`,
      [userId],
    ),
    getNotificationSettings(),
  ]);

  return (
    <div className="max-w-md space-y-8">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="text-sm text-text-muted">{user?.email}</p>
      </div>

      <section id="account" className="scroll-mt-20 space-y-3">
        <h2 className="eyebrow text-text-faint">Account</h2>

        <form action={saveProfile} className="card space-y-3 p-4">
          <label className="block space-y-1">
            <span className="text-xs text-text-muted">Name</span>
            <input name="name" defaultValue={user?.name ?? ""} maxLength={80} autoComplete="name" className="input" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-text-muted">Mobile number</span>
            <input
              type="tel"
              name="phone"
              defaultValue={user?.phone ? formatPhone(user.phone) : ""}
              autoComplete="tel"
              inputMode="tel"
              placeholder="(555) 123-4567"
              className="input tabular-nums"
            />
          </label>
          {error === "phone" && <p className="text-xs text-danger">Enter a valid mobile number.</p>}
          {saved === "profile" && <p className="text-xs text-accent">Saved.</p>}
          <button type="submit" className={buttonClass}>
            Save
          </button>
        </form>

        <form id="email" action={requestEmailChange} className="card scroll-mt-20 space-y-3 p-4">
          <div>
            <h3 className="text-sm font-semibold text-text">Email</h3>
            <p className="text-xs text-text-muted">
              You sign in with <span className="text-text">{user?.email}</span>. To change it, confirm the link we email
              to both your current and new address.
            </p>
          </div>
          <input type="email" name="email" required autoComplete="email" placeholder="New email address" className="input" />
          {error && EMAIL_ERRORS[error] && <p className="text-xs text-danger">{EMAIL_ERRORS[error]}</p>}
          {email === "sent" && <p className="text-xs text-accent">Check both inboxes and open the confirmation links.</p>}
          {email === "confirmed" && (
            <p className="text-xs text-accent">Link confirmed. If you haven&apos;t yet, open the link sent to your other address too.</p>
          )}
          <button type="submit" className={buttonClass}>
            Change email
          </button>
        </form>

        <ChangePasswordCard />
        <TwoFactorCard enabled={Boolean(user?.mfa_enabled)} />

        <div className="card space-y-3 p-4">
          <div>
            <h3 className="text-sm font-semibold text-text">Sign out</h3>
            <p className="text-xs text-text-muted">Lost a phone or used a shared computer? Sign out everywhere at once.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <form action={logout}>
              <button type="submit" className={buttonClass}>
                Sign out
              </button>
            </form>
            <form action={signOutEverywhere}>
              <button type="submit" className={buttonClass}>
                Sign out of all devices
              </button>
            </form>
          </div>
        </div>

        <DeleteAccountCard error={error === "confirm" || error === "delete-login" ? error : undefined} />
      </section>

      <section id="notifications" className="scroll-mt-20 space-y-3">
        <h2 className="eyebrow text-text-faint">Notifications</h2>
        <div className="card space-y-4 p-4">
          <form action={saveContactSettings} className="space-y-2">
            <TimeZoneInput />
            <label className="flex items-start gap-2 text-xs text-text-muted">
              <input type="checkbox" name="sms_opt_in" defaultChecked={notify.smsOptIn} disabled={!notify.phone} className="mt-0.5" />
              <span>Text me task reminders. Message &amp; data rates may apply. Reply STOP to opt out, HELP for help.</span>
            </label>
            {!notify.phone && <p className="text-xs text-text-faint">Add a mobile number under Account to get texts.</p>}
            {!notify.smsAvailable && <p className="text-xs text-text-faint">Texts aren&apos;t switched on for the app yet.</p>}
            <button type="submit" className={buttonClass}>
              Save
            </button>
          </form>

          <div className="space-y-1">
            <p className="text-xs text-text-muted">Push notifications</p>
            {notify.pushAvailable && notify.pushPublicKey ? (
              <PushToggle publicKey={notify.pushPublicKey} />
            ) : (
              <p className="text-xs text-text-faint">Push notifications aren&apos;t switched on for the app yet.</p>
            )}
          </div>

          {(notify.pushAvailable || notify.smsAvailable) && (
            <form action={sendTestNotification}>
              <button type="submit" className="text-xs text-text-muted hover:text-accent">
                Send a test notification
              </button>
            </form>
          )}
        </div>
      </section>

    </div>
  );
}
