import type { Metadata } from "next";
import { requireOwner } from "@/lib/owner";
import { getAppSettings, clearAppSettingsCache } from "@/lib/app-settings";
import { queryOne } from "@/lib/db/client";
import { OwnerNav } from "@/components/owner/OwnerNav";
import { ownerSetAnnouncement, ownerSetMaintenance } from "@/lib/actions/owner";
import { TimeZoneOffset } from "@/components/owner/TimeZoneOffset";

export const metadata: Metadata = { title: "Controls · Command center", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  maintenance_on: "Maintenance mode is ON. Everyone but you sees the “back soon” page (within 15 seconds).",
  maintenance_off: "Maintenance mode is off. Everyone is back in.",
  announcement_posted: "Announcement posted. Each person sees it once until they dismiss it.",
  announcement_cleared: "Announcement removed.",
  announcement_short: "Write a short announcement first.",
};

/** Maintenance mode and the announcement banner. Suspending accounts is on the Accounts tab. */
export default async function OwnerControlsPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireOwner();
  const { msg } = await searchParams;
  clearAppSettingsCache(); // always show the saved state here
  const [s, seen] = await Promise.all([
    getAppSettings(),
    queryOne<{ dismissed: number; total: number }>(
      `select count(*) filter (where announcement_dismissed_id = (select announcement_id from app_settings where id))::int as dismissed,
              count(*)::int as total from users`,
    ),
  ]);

  return (
    <div className="max-w-3xl space-y-8">
      <OwnerNav active="/owner/controls" title="Controls" intro="Lock the app for updates, or tell everyone about something new. Your own account is never locked out." />
      {msg && MESSAGES[msg] && <p className={msg === "announcement_short" ? "flag text-sm" : "text-sm text-accent"}>{MESSAGES[msg]}</p>}

      <section className="space-y-3">
        <h2 className="section-label">Maintenance mode</h2>
        <div className={`card space-y-4 p-4 ${s.maintenanceOn ? "flag-urgent" : ""}`}>
          <p className="text-sm text-text">
            {s.maintenanceOn ? (
              <>
                <strong>On.</strong> Everyone except you sees the &ldquo;Down for a quick update&rdquo; page. Referral links say they&apos;re paused.
              </>
            ) : (
              "Off. Turn it on while you ship a big update: everyone except you sees a “back soon” page; the landing page, legal pages, payments and reminders keep working, and referral links say they're paused."
            )}
          </p>
          {s.maintenanceOn ? (
            <form action={ownerSetMaintenance}>
              <input type="hidden" name="on" value="0" />
              <button type="submit" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg hover:bg-accent-dim">
                Turn maintenance off
              </button>
            </form>
          ) : (
            <form action={ownerSetMaintenance} className="space-y-3">
              <input type="hidden" name="on" value="1" />
              <TimeZoneOffset />
              <label className="block space-y-1">
                <span className="text-xs text-text-muted">Message (optional)</span>
                <input name="message" maxLength={300} placeholder="We're adding something new. Your data is safe." className="input" />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-text-muted">Back by (optional, shown to people; it doesn&apos;t turn off by itself)</span>
                <input type="datetime-local" name="until" className="input" />
              </label>
              <button type="submit" className="rounded-full bg-danger px-4 py-2 text-sm font-semibold text-bg">
                Turn maintenance on
              </button>
            </form>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="section-label">Announcement</h2>
        <div className="card space-y-4 p-4">
          {s.announcementText ? (
            <>
              <p className="text-sm text-text">
                <span className="tag tag-n mr-2">Live</span>
                {s.announcementText}
                {s.announcementLink && <span className="text-text-muted"> → {s.announcementLink}</span>}
              </p>
              <p className="text-xs text-text-muted">
                Dismissed by {seen?.dismissed ?? 0} of {seen?.total ?? 0} accounts.
              </p>
              <form action={ownerSetAnnouncement}>
                <input type="hidden" name="clear" value="1" />
                <button type="submit" className="text-sm text-text-muted hover:text-text">
                  Remove it
                </button>
              </form>
            </>
          ) : (
            <p className="text-sm text-text-muted">Nothing showing. A new one appears at the top of the app for everyone, once, until they close it.</p>
          )}
          <form action={ownerSetAnnouncement} className="space-y-3 border-t border-border pt-4">
            <label className="block space-y-1">
              <span className="text-xs text-text-muted">{s.announcementText ? "Replace with" : "Message"}</span>
              <input name="text" required minLength={3} maxLength={300} placeholder="New: record Outcomes for every client" className="input" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-text-muted">Link (optional): a page in the app like /settings/outcomes, or https://…</span>
              <input name="link" maxLength={300} placeholder="/settings/outcomes" className="input" spellCheck={false} />
            </label>
            <button type="submit" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg hover:bg-accent-dim">
              Post announcement
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
