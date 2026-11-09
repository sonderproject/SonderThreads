import { TwoFactorCard } from "@/components/settings/TwoFactorCard";
import { DeleteAccountCard } from "@/components/settings/DeleteAccountCard";
import { ChangePasswordCard } from "@/components/settings/ChangePasswordCard";
import { PushToggle } from "@/components/notifications/PushToggle";
import { TimeZoneInput } from "@/components/notifications/TimeZoneInput";
import { requireUserId } from "@/lib/current-user";
import { queryOne } from "@/lib/db/client";
import { logout, requestEmailChange, signOutEverywhere } from "@/app/login/actions";
import { saveProfile } from "@/lib/actions/profile";
import { ImportBackupCard } from "@/components/settings/ImportBackupCard";
import { getMembership, ROLE_LABELS } from "@/lib/org";
import Link from "next/link";
import { getNotificationSettings, sendTestNotification } from "@/lib/actions/notifications";
import { saveNotificationPrefs, saveSecurityPrefs } from "@/lib/actions/settings";
import { getUserSettings } from "@/lib/settings";
import { IDLE_TIMEOUT_OPTIONS, REMINDER_LEAD_OPTIONS, SUPPORT_EMAIL, durationLabel, hourLabel } from "@/lib/settings-options";
import packageJson from "@/package.json";
import { formatPhone } from "@/lib/notify/phone";

/** Settings: account, notifications, security and data, in one place (was Account + Settings). */
const EMAIL_ERRORS: Record<string, string> = {
  "email-invalid": "Enter a valid email address.",
  "email-same": "That's already your email.",
  "email-taken": "Another account already uses that email.",
  "email-rate": "Too many emails sent. Try again in a little while.",
  "email-failed": "Couldn't start the change. Try again.",
};

const EXPORTS = [
  { table: "people", label: "People" },
  { table: "notes", label: "Notes" },
  { table: "tasks", label: "Tasks" },
  { table: "check_ins", label: "Check-ins" },
  { table: "lists", label: "Lists" },
  { table: "list_items", label: "List entries" },
  { table: "activity", label: "Activity history" },
];

const HOURS = Array.from({ length: 24 }, (_, h) => h);

function HourSelect({ name, value, label }: { name: string; value: number; label: string }) {
  return (
    <select name={name} defaultValue={value} aria-label={label} className="input w-auto">
      {HOURS.map((h) => (
        <option key={h} value={h}>
          {hourLabel(h)}
        </option>
      ))}
    </select>
  );
}

const buttonClass = "rounded border border-border px-3 py-1.5 text-sm font-medium text-text hover:bg-bg-hover";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; email?: string }>;
}) {
  const { error, saved, email } = await searchParams;
  const userId = await requireUserId();
  const [user, notify, prefs, membership] = await Promise.all([
    queryOne<{ email: string; name: string | null; phone: string | null; mfa_enabled: boolean }>(
      `select email, name, phone, mfa_enabled from users where id = $1`,
      [userId],
    ),
    getNotificationSettings(),
    getUserSettings(),
    getMembership(),
  ]);

  return (
    <div className="max-w-md space-y-8">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="text-sm text-text-muted">{user?.email}</p>
      </div>

      <section id="account" className="scroll-mt-20 space-y-3">
        <h2 className="section-label">Account</h2>

        <form key={`${user?.name}|${user?.phone}`} action={saveProfile} className="card space-y-3 p-4">
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

        <DeleteAccountCard error={error === "confirm" || error === "delete-login" || error === "last-admin" ? error : undefined} />
      </section>

      {membership && (
        <section id="organization" className="scroll-mt-20 space-y-3">
          <h2 className="section-label">Organization</h2>
          <div className="card space-y-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-text">{membership.orgName}</p>
              <span className={`tag shrink-0 ${membership.active ? "tag-v" : "bg-bg-hover text-text-muted"}`}>
                {membership.active ? ROLE_LABELS[membership.role] : "Deactivated"}
              </span>
            </div>
            {membership.active ? (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {membership.role === "admin" && (
                  <Link href="/organization" className="text-accent hover:underline">
                    Manage staff and invites
                  </Link>
                )}
                <Link href="/organization/clients" className="text-accent hover:underline">
                  Bring clients in
                </Link>
              </div>
            ) : (
              <p className="text-xs text-text-muted">Your access to this organization was turned off by an admin.</p>
            )}
            <p className="text-xs text-text-faint">Your tasks, notes and lists that aren&apos;t about a client are always private.</p>
          </div>
        </section>
      )}

      {!membership && (
        <section id="organization" className="scroll-mt-20 space-y-3">
          <h2 className="section-label">Organization</h2>
          <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-text">Run a team or agency?</h3>
              <p className="text-xs text-text-muted">
                Invite your staff and give supervisors a view of your clients. Personal tasks and notes stay private.
              </p>
            </div>
            <Link
              href="/organization/new"
              className="shrink-0 rounded border border-border px-3 py-1.5 text-sm font-medium text-text hover:bg-bg-hover"
            >
              Set up an organization
            </Link>
          </div>
        </section>
      )}

      <section id="notifications" className="scroll-mt-20 space-y-3">
        <h2 className="section-label">Notifications</h2>
        <div className="card space-y-4 p-4">
          <div className="space-y-1">
            <p className="text-xs text-text-muted">Push notifications on this device</p>
            {notify.pushAvailable && notify.pushPublicKey ? (
              <PushToggle publicKey={notify.pushPublicKey} />
            ) : (
              <p className="text-xs text-text-faint">Push notifications aren&apos;t switched on for the app yet.</p>
            )}
          </div>

          <form key={JSON.stringify(prefs)} action={saveNotificationPrefs} className="space-y-4">
            <TimeZoneInput />
            <label className="block space-y-1">
              <span className="text-xs text-text-muted">Remind me about tasks</span>
              <select name="reminder_lead_minutes" defaultValue={prefs.reminderLeadMinutes} className="input">
                {REMINDER_LEAD_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m === 60 ? "1 hour" : `${m} minutes`} before they&apos;re due
                  </option>
                ))}
              </select>
              <span className="block text-xs text-text-faint">All-day tasks are reminded at 8 AM.</span>
            </label>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-text">
                <input type="checkbox" name="daily_summary_enabled" defaultChecked={prefs.dailySummaryEnabled} />
                Daily summary of what&apos;s due
              </label>
              <div className="flex items-center gap-2 pl-6 text-xs text-text-muted">
                <span>at</span>
                <HourSelect name="daily_summary_hour" value={prefs.dailySummaryHour} label="Daily summary time" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-text">
                <input type="checkbox" name="quiet_hours_enabled" defaultChecked={prefs.quietHoursEnabled} />
                Quiet hours: no push or texts
              </label>
              <div className="flex flex-wrap items-center gap-2 pl-6 text-xs text-text-muted">
                <span>from</span>
                <HourSelect name="quiet_start_hour" value={prefs.quietStartHour} label="Quiet hours start" />
                <span>to</span>
                <HourSelect name="quiet_end_hour" value={prefs.quietEndHour} label="Quiet hours end" />
              </div>
            </div>

            <label className="flex items-start gap-2 text-xs text-text-muted">
              <input type="checkbox" name="sms_opt_in" defaultChecked={notify.smsOptIn} disabled={!notify.phone} className="mt-0.5" />
              <span>Text me reminders. Message &amp; data rates may apply. Reply STOP to opt out, HELP for help.</span>
            </label>
            {!notify.phone && <p className="text-xs text-text-faint">Add a mobile number under Account to get texts.</p>}
            {!notify.smsAvailable && <p className="text-xs text-text-faint">Texts aren&apos;t switched on for the app yet.</p>}

            {saved === "notifications" && <p className="text-xs text-accent">Saved.</p>}
            <button type="submit" className={buttonClass}>
              Save
            </button>
          </form>

          {(notify.pushAvailable || notify.smsAvailable) && (
            <form action={sendTestNotification}>
              <button type="submit" className="text-xs text-text-muted hover:text-accent">
                Send a test notification
              </button>
            </form>
          )}
        </div>
      </section>


      <section id="security" className="scroll-mt-20 space-y-3">
        <h2 className="section-label">Privacy &amp; security</h2>
        {/* key: React resets a form after its action runs; a new key shows the values just saved. */}
        <form key={JSON.stringify(prefs)} action={saveSecurityPrefs} className="card space-y-3 p-4">
          <label className="block space-y-1">
            <span className="text-xs text-text-muted">Auto-lock: sign me out after no activity for</span>
            <select name="idle_timeout_minutes" defaultValue={prefs.idleTimeoutMinutes} className="input">
              {IDLE_TIMEOUT_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {durationLabel(m)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-start gap-2 text-sm text-text">
            <input type="checkbox" name="stay_signed_in" defaultChecked={prefs.staySignedIn} className="mt-1" />
            <span>
              Stay signed in
              <span className="block text-xs text-text-muted">
                Turns auto-lock off. Only use this on a device nobody else uses.
              </span>
            </span>
          </label>
          {saved === "security" && <p className="text-xs text-accent">Saved.</p>}
          <button type="submit" className={buttonClass}>
            Save
          </button>
        </form>
        <div className="card flex items-start justify-between gap-3 p-4">
          <div>
            <h3 className="text-sm font-semibold text-text">Face ID / fingerprint unlock</h3>
            <p className="text-xs text-text-muted">Unlock with your face or fingerprint instead of signing in again.</p>
          </div>
          <span className="tag shrink-0 bg-bg-hover text-text-muted">Coming with the mobile app</span>
        </div>
      </section>

      <section id="data" className="scroll-mt-20 space-y-3">
        <h2 className="section-label">Data</h2>
        <div className="card space-y-3 p-4">
          <div>
            <h3 className="text-sm font-semibold text-text">Export my data</h3>
            <p className="text-xs text-text-muted">Spreadsheet files (CSV), one per kind of record.</p>
          </div>
          <ul className="flex flex-wrap gap-2">
            {EXPORTS.map((e) => (
              <li key={e.table}>
                <a href={`/api/export?format=csv&table=${e.table}`} className={`inline-block ${buttonClass}`}>
                  {e.label}
                </a>
              </li>
            ))}
          </ul>
          <a href="/api/export" className="inline-block text-xs text-text-muted hover:text-accent">
            Or download everything as one backup file (JSON)
          </a>
        </div>
        <ImportBackupCard />
      </section>

      <section id="about" className="scroll-mt-20 space-y-3">
        <h2 className="section-label">About</h2>
        <div className="card divide-y divide-border-subtle text-sm">
          <div className="flex items-center justify-between p-4">
            <span className="text-text">Version</span>
            <span className="tabular-nums text-text-muted">{packageJson.version}</span>
          </div>
          <a href="/privacy" className="flex items-center justify-between p-4 hover:bg-bg-hover">
            <span className="text-text">Privacy policy</span>
            <span className="text-text-muted" aria-hidden>→</span>
          </a>
          <a href="/terms" className="flex items-center justify-between p-4 hover:bg-bg-hover">
            <span className="text-text">Terms of service</span>
            <span className="text-text-muted" aria-hidden>→</span>
          </a>
          <div className="flex items-center justify-between gap-3 p-4">
            <span className="text-text">Contact support</span>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="truncate text-accent hover:underline">
              {SUPPORT_EMAIL}
            </a>
          </div>
        </div>
      </section>

    </div>
  );
}
