import { TwoFactorCard } from "@/components/settings/TwoFactorCard";
import { DeleteAccountCard } from "@/components/settings/DeleteAccountCard";
import { ChangePasswordCard } from "@/components/settings/ChangePasswordCard";
import { PushToggle } from "@/components/notifications/PushToggle";
import { TimeZoneInput } from "@/components/notifications/TimeZoneInput";
import { requireUserId } from "@/lib/current-user";
import { queryOne } from "@/lib/db/client";
import { logout } from "@/app/login/actions";
import { getNotificationSettings, saveContactSettings, sendTestNotification } from "@/lib/actions/notifications";
import { formatPhone } from "@/lib/notify/phone";

/** Settings: account, notifications, security and data, in one place (was Account + Settings). */
export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const userId = await requireUserId();
  const [user, notify] = await Promise.all([
    queryOne<{ email: string; mfa_enabled: boolean }>(`select email, mfa_enabled from users where id = $1`, [userId]),
    getNotificationSettings(),
  ]);

  return (
    <div className="max-w-md space-y-8">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="text-sm text-text-muted">{user?.email}</p>
      </div>

      <section id="notifications" className="scroll-mt-20 space-y-3">
        <h2 className="eyebrow text-text-faint">Notifications</h2>
        <div className="card space-y-4 p-4">
          <form action={saveContactSettings} className="space-y-2">
            <TimeZoneInput />
            <label className="block space-y-1">
              <span className="text-xs text-text-muted">Mobile number</span>
              <input
                type="tel"
                name="phone"
                defaultValue={notify.phone ? formatPhone(notify.phone) : ""}
                autoComplete="tel"
                inputMode="tel"
                placeholder="(555) 123-4567"
                className="input tabular-nums"
              />
            </label>
            {error === "phone" && <p className="text-xs text-danger">Enter a valid mobile number.</p>}
            <label className="flex items-start gap-2 text-xs text-text-muted">
              <input type="checkbox" name="sms_opt_in" defaultChecked={notify.smsOptIn} className="mt-0.5" />
              <span>Text me task reminders. Message &amp; data rates may apply. Reply STOP to opt out, HELP for help.</span>
            </label>
            {!notify.smsAvailable && <p className="text-xs text-text-faint">Texts aren&apos;t switched on for the app yet.</p>}
            <button type="submit" className="rounded border border-border px-3 py-1.5 text-sm font-medium text-text hover:bg-bg-hover">
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

      <section className="space-y-3">
        <h2 className="eyebrow text-text-faint">Security</h2>
        <TwoFactorCard enabled={Boolean(user?.mfa_enabled)} />
        <ChangePasswordCard />
      </section>

      <section className="space-y-3">
        <h2 className="eyebrow text-text-faint">Account</h2>
        <form action={logout}>
          <button type="submit" className="rounded border border-border px-3 py-1.5 text-sm font-medium text-text hover:bg-bg-hover">
            Sign out
          </button>
        </form>
        <DeleteAccountCard error={error === "confirm" || error === "delete-login" ? error : undefined} />
      </section>
    </div>
  );
}
