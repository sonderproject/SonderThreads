import Link from "next/link";
import { TwoFactorCard } from "@/components/settings/TwoFactorCard";
import { DeleteAccountCard } from "@/components/settings/DeleteAccountCard";
import { ChangePasswordCard } from "@/components/settings/ChangePasswordCard";
import { ImportBackupCard } from "@/components/settings/ImportBackupCard";
import { ImportClientsCard } from "@/components/settings/ImportClientsCard";
import { PushToggle } from "@/components/notifications/PushToggle";
import { TimeZoneInput } from "@/components/notifications/TimeZoneInput";
import { PendingInvites } from "@/components/org/PendingInvites";
import { ManageSubscriptionCard } from "@/components/billing/ManageSubscriptionCard";
import { CalendarSyncSettings } from "@/components/settings/CalendarSyncSettings";
import { ContactSupportCard } from "@/components/settings/ContactSupportCard";
import { getMyCalendarLink, listLinkedCalendars } from "@/lib/actions/calendar";
import { requireUserId } from "@/lib/current-user";
import { queryOne } from "@/lib/db/client";
import { logout, requestEmailChange, signOutEverywhere } from "@/app/login/actions";
import { saveProfile } from "@/lib/actions/profile";
import { clearMyData } from "@/lib/actions/clear-data";
import { getMembership, getPendingInvites, ROLE_LABELS } from "@/lib/org";
import { getNotificationSettings, sendTestNotification } from "@/lib/actions/notifications";
import { saveNotificationPrefs, saveSecurityPrefs } from "@/lib/actions/settings";
import { getUserSettings } from "@/lib/settings";
import { IDLE_TIMEOUT_OPTIONS, REMINDER_LEAD_OPTIONS, SUPPORT_EMAIL, durationLabel, hourLabel } from "@/lib/settings-options";
import { formatPhone } from "@/lib/notify/phone";
import packageJson from "@/package.json";
import type { SettingsSlug } from "@/lib/settings-sections";

export type SettingsQuery = { error?: string; saved?: string; email?: string; billing?: string };

const EMAIL_ERRORS: Record<string, string> = {
  "email-invalid": "Enter a valid email address.",
  "email-same": "That's already your email.",
  "email-taken": "Another account already uses that email.",
  "email-rate": "Too many emails sent. Try again in a little while.",
  "email-failed": "Couldn't start the change. Try again.",
};

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const buttonClass = "rounded-full border border-border px-3 py-1.5 text-sm font-medium text-text hover:bg-bg-hover";

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

async function me() {
  const userId = await requireUserId();
  return queryOne<{ email: string; name: string | null; phone: string | null; mfa_enabled: boolean }>(
    `select email, name, phone, mfa_enabled from users where id = $1`,
    [userId],
  );
}

/** One settings section's content. */
export async function SettingsSection({ slug, q }: { slug: SettingsSlug; q: SettingsQuery }) {
  switch (slug) {
    case "account":
      return <AccountSection q={q} />;
    case "subscription":
      return <ManageSubscriptionCard message={q.billing} />;
    case "notifications":
      return <NotificationsSection q={q} />;
    case "calendar":
      return <CalendarSection />;
    case "security":
      return <SecuritySection q={q} />;
    case "organization":
      return <OrganizationSection />;
    case "data":
      return <DataSection q={q} />;
    case "about":
      return <AboutSection />;
  }
}

async function CalendarSection() {
  const [linked, myLink] = await Promise.all([listLinkedCalendars(), getMyCalendarLink()]);
  return <CalendarSyncSettings linked={linked} myLink={myLink} />;
}

async function AccountSection({ q }: { q: SettingsQuery }) {
  const user = await me();
  const { error, saved, email } = q;
  return (
    <>
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
        {error === "phone-used" && <p className="text-xs text-danger">That mobile number is already on another account.</p>}
        {saved === "profile" && <p className="text-xs text-accent">Saved.</p>}
        <button type="submit" className={buttonClass}>
          Save
        </button>
      </form>

      <form id="email" action={requestEmailChange} className="card scroll-mt-20 space-y-3 p-4">
        <div>
          <h3 className="text-sm font-semibold text-text">Email</h3>
          <p className="text-xs text-text-muted">
            You sign in with <span className="text-text">{user?.email}</span>. To change it, confirm the link we email to both
            your current and new address.
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
    </>
  );
}

async function NotificationsSection({ q }: { q: SettingsQuery }) {
  const [notify, prefs] = await Promise.all([getNotificationSettings(), getUserSettings()]);
  return (
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
        {!notify.phone && (
          <p className="text-xs text-text-faint">
            Add a mobile number under{" "}
            <Link href="/settings/account" className="text-accent hover:underline">
              Account
            </Link>{" "}
            to get texts.
          </p>
        )}
        {!notify.smsAvailable && <p className="text-xs text-text-faint">Texts aren&apos;t switched on for the app yet.</p>}

        {q.saved === "notifications" && <p className="text-xs text-accent">Saved.</p>}
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
  );
}

async function SecuritySection({ q }: { q: SettingsQuery }) {
  const [user, prefs] = await Promise.all([me(), getUserSettings()]);
  return (
    <>
      <ChangePasswordCard />
      <TwoFactorCard enabled={Boolean(user?.mfa_enabled)} />

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
            <span className="block text-xs text-text-muted">Turns auto-lock off. Only use this on a device nobody else uses.</span>
          </span>
        </label>
        {q.saved === "security" && <p className="text-xs text-accent">Saved.</p>}
        <button type="submit" className={buttonClass}>
          Save
        </button>
      </form>

      <div className="card space-y-3 p-4">
        <div>
          <h3 className="text-sm font-semibold text-text">Devices</h3>
          <p className="text-xs text-text-muted">Lost a phone or used a shared computer? Sign out everywhere at once.</p>
        </div>
        <form action={signOutEverywhere}>
          <button type="submit" className={buttonClass}>
            Sign out of all devices
          </button>
        </form>
      </div>

      <div className="card flex items-start justify-between gap-3 p-4">
        <div>
          <h3 className="text-sm font-semibold text-text">Face ID / fingerprint unlock</h3>
          <p className="text-xs text-text-muted">Unlock with your face or fingerprint instead of signing in again.</p>
        </div>
        <span className="tag shrink-0 bg-bg-hover text-text-muted">Coming with the mobile app</span>
      </div>
    </>
  );
}

async function OrganizationSection() {
  const [membership, invites] = await Promise.all([getMembership(), getPendingInvites()]);
  return (
    <>
      {invites.length > 0 && <PendingInvites invites={invites} />}
      {membership ? (
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
                  Manage staff, invites and referrals
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
      ) : (
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-text">Run a team or agency?</h3>
            <p className="text-xs text-text-muted">
              Invite your staff and give supervisors a view of your clients. Personal tasks and notes stay private.
            </p>
          </div>
          <Link href="/organization/new" className={`shrink-0 ${buttonClass}`}>
            Set up an organization
          </Link>
        </div>
      )}
    </>
  );
}

async function DataSection({ q }: { q: SettingsQuery }) {
  const membership = await getMembership();
  const { error, saved } = q;
  const exports = [
    { table: "people", label: "People" },
    { table: "notes", label: "Notes" },
    { table: "tasks", label: "Tasks" },
    { table: "check_ins", label: membership?.active ? "Check-ins" : "Meetings" },
    { table: "lists", label: "Lists" },
    { table: "list_items", label: "List entries" },
    { table: "activity", label: "Activity history" },
  ];
  return (
    <>
      <ImportClientsCard />
      <div className="card space-y-3 p-4">
        <div>
          <h3 className="text-sm font-semibold text-text">Export my data</h3>
          <p className="text-xs text-text-muted">Spreadsheet files (CSV), one per kind of record.</p>
        </div>
        <ul className="flex flex-wrap gap-2">
          {exports.map((e) => (
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
      <form id="clear" action={clearMyData} className="card scroll-mt-20 space-y-3 border-danger/40 p-4">
        <div>
          <h3 className="text-sm font-semibold text-danger">Clear my data</h3>
          <p className="text-xs text-text-muted">
            Deletes all your people, notes, tasks, lists, {membership?.active ? "check-ins" : "meetings"} and history, for a fresh
            start (for example after a messy import). Your account and settings stay.
            {membership?.active ? ` ${membership.orgName}'s clients are not affected.` : ""} This can&apos;t be undone, so download a
            backup above first.
          </p>
        </div>
        <label className="block space-y-1">
          <span className="text-xs text-text-muted">
            Type <strong className="text-text">CLEAR</strong> to confirm
          </span>
          <input name="confirm" autoComplete="off" className="input w-40" />
        </label>
        {error === "clear-confirm" && <p className="text-xs text-danger">Type CLEAR exactly to confirm.</p>}
        {saved === "cleared" && <p className="text-xs text-accent">Your data was cleared.</p>}
        <button type="submit" className="rounded-full border border-danger px-4 py-1.5 text-sm font-medium text-danger hover:bg-bg-hover">
          Clear my data
        </button>
      </form>
      <DeleteAccountCard error={error === "confirm" || error === "delete-login" || error === "last-admin" ? error : undefined} />
    </>
  );
}

function AboutSection() {
  return (
    <>
    <ContactSupportCard supportEmail={SUPPORT_EMAIL} />
    <div className="card divide-y divide-border-subtle text-sm">
      <div className="flex items-center justify-between p-4">
        <span className="text-text">Version</span>
        <span className="tabular-nums text-text-muted">{packageJson.version}</span>
      </div>
      <a href="/privacy" className="flex items-center justify-between p-4 hover:bg-bg-hover">
        <span className="text-text">Privacy policy</span>
        <span className="text-text-muted" aria-hidden>
          →
        </span>
      </a>
      <a href="/terms" className="flex items-center justify-between p-4 hover:bg-bg-hover">
        <span className="text-text">Terms of service</span>
        <span className="text-text-muted" aria-hidden>
          →
        </span>
      </a>
    </div>
    </>
  );
}

/** Sign out, shown at the bottom of the Settings menu. */
export function SignOutButton() {
  return (
    <form action={logout}>
      <button type="submit" className="w-full rounded-full border border-border px-4 py-2.5 text-sm font-medium text-text hover:bg-bg-hover">
        Sign out
      </button>
    </form>
  );
}
