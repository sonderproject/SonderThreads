import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { deleteAccount, logout } from "@/app/login/actions";
import { getNotificationSettings, saveContactSettings, sendTestNotification } from "@/lib/actions/notifications";
import { formatPhone } from "@/lib/notify/phone";
import { PushToggle } from "@/components/notifications/PushToggle";
import { TimeZoneInput } from "@/components/notifications/TimeZoneInput";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { error } = await searchParams;
  const settings = await getNotificationSettings();

  return (
    <div className="max-w-md space-y-8">
      <div className="space-y-1">
        <h1 className="font-mono text-lg uppercase tracking-wide text-text">Account</h1>
        <p className="text-sm text-text-muted">{user.email}</p>
      </div>

      <section className="space-y-4 rounded border border-border p-4">
        <p className="text-sm font-medium text-text">Notifications</p>

        <form action={saveContactSettings} className="space-y-2">
          <TimeZoneInput />
          <label className="block space-y-1">
            <span className="text-xs text-text-muted">Mobile number</span>
            <input
              type="tel"
              name="phone"
              defaultValue={settings.phone ? formatPhone(settings.phone) : ""}
              autoComplete="tel"
              inputMode="tel"
              placeholder="(555) 123-4567"
              className="input font-mono"
            />
          </label>
          {error === "phone" && <p className="text-xs text-danger">Enter a valid mobile number.</p>}
          <label className="flex items-start gap-2 text-xs text-text-muted">
            <input type="checkbox" name="sms_opt_in" defaultChecked={settings.smsOptIn} className="mt-0.5" />
            <span>
              Text me task reminders. Message &amp; data rates may apply. Reply STOP to opt out, HELP for help.
            </span>
          </label>
          {!settings.smsAvailable && (
            <p className="text-xs text-text-faint">Texts aren&apos;t switched on for the app yet.</p>
          )}
          <button
            type="submit"
            className="rounded border border-border px-3 py-1.5 text-sm font-medium text-text hover:bg-bg-hover"
          >
            Save
          </button>
        </form>

        <div className="space-y-1">
          <p className="text-xs text-text-muted">Push notifications</p>
          {settings.pushAvailable && settings.pushPublicKey ? (
            <PushToggle publicKey={settings.pushPublicKey} />
          ) : (
            <p className="text-xs text-text-faint">Push notifications aren&apos;t switched on for the app yet.</p>
          )}
        </div>

        {(settings.pushAvailable || settings.smsAvailable) && (
          <form action={sendTestNotification}>
            <button type="submit" className="text-xs text-text-muted hover:text-accent">
              Send a test notification
            </button>
          </form>
        )}
      </section>

      <form action={logout}>
        <button
          type="submit"
          className="rounded border border-border px-3 py-1.5 text-sm font-medium text-text hover:bg-bg-hover"
        >
          Sign out
        </button>
      </form>

      <form action={deleteAccount} className="space-y-2 rounded border border-danger/40 p-4">
        <p className="text-sm font-medium text-danger">Delete account</p>
        <p className="text-xs text-text-muted">
          Permanently deletes your account and everything in it: people, lists, tasks and notes. This
          can&apos;t be undone. Type DELETE to confirm.
        </p>
        {error === "confirm" && <p className="text-xs text-danger">Type DELETE exactly to confirm.</p>}
        <input name="confirm" autoComplete="off" placeholder="DELETE" className="input font-mono" />
        <button
          type="submit"
          className="rounded border border-danger/40 px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger/10"
        >
          Delete my account
        </button>
      </form>
    </div>
  );
}
