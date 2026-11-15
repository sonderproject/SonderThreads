import { requireUserId } from "@/lib/current-user";
import { myBookingPage } from "@/lib/booking";
import { saveBookingPage } from "@/lib/actions/booking";
import { SLOT_CHOICES } from "@/lib/referral-slots";
import { US_ZONES } from "@/lib/time-zones";
import { appUrl } from "@/lib/email";
import { CopyText } from "@/components/org/CopyText";

const DAYS = [
  [1, "Monday"],
  [2, "Tuesday"],
  [3, "Wednesday"],
  [4, "Thursday"],
  [5, "Friday"],
  [6, "Saturday"],
  [0, "Sunday"],
] as const;

const ERRORS: Record<string, string> = {
  hours: "Check your hours: each open day needs a start time before its end time.",
  "no-hours": "Open at least one day, or turn the booking link off.",
  slot: "Choose an appointment length.",
  timezone: "Choose a time zone.",
  max: "Bookings per day must be a number from 1 to 100, or left blank.",
};

/** Settings → Booking link: a page where anyone can book a time with you. */
export async function BookingSection({ q }: { q: { saved?: string; error?: string } }) {
  const page = await myBookingPage(await requireUserId());
  const zones = US_ZONES.some(([z]) => z === page.tz) ? US_ZONES : ([[page.tz, page.tz], ...US_ZONES] as const);
  const link = `${appUrl()}/book/${page.code}`;
  return (
    <div className="space-y-4">
      <div className="card space-y-3 p-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-text">Your booking link</h3>
          <p className="text-xs text-text-muted">
            Share it on your website, email signature or socials. People pick an open time and leave their name and email or phone. Each booking
            adds them to your people (or finds them if they&apos;re already there), puts the appointment on your Tasks and calendar, and emails
            them a confirmation. Times that clash with your timed tasks aren&apos;t offered.
          </p>
        </div>
        {page.enabled ? (
          <>
            <CopyText value={link} />
            <a href={link} target="_blank" className="text-xs text-accent hover:underline">
              Open your booking page →
            </a>
          </>
        ) : (
          <p className="text-sm text-text">
            <span className="tag tag-u mr-2">Off</span>
            Turn it on below to get your link.
          </p>
        )}
        {q.saved === "new-link" && <p className="text-xs text-accent">New link made. The old one no longer works.</p>}
      </div>

      <form action={saveBookingPage} className="card space-y-5 p-4">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="enabled" value="1" defaultChecked={page.enabled} className="h-4 w-4 accent-[var(--accent)]" />
          Let people book a time with me
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-text-muted">Page title</span>
          <input name="title" maxLength={80} defaultValue={page.title} className="input" />
        </label>
        <fieldset className="space-y-2">
          <legend className="eyebrow mb-1 text-text-faint">Open hours</legend>
          {DAYS.map(([d, label]) => {
            const w = page.hours[String(d)]?.[0];
            return (
              <div key={d} className="flex flex-wrap items-center gap-2 text-sm">
                <label className="flex w-32 items-center gap-2">
                  <input type="checkbox" name={`open_${d}`} value="1" defaultChecked={Boolean(w)} className="h-4 w-4 accent-[var(--accent)]" />
                  {label}
                </label>
                <input type="time" name={`start_${d}`} defaultValue={w?.[0] ?? "09:00"} step={900} aria-label={`${label} opens`} className="input w-32 tabular-nums" />
                <span className="text-text-muted">to</span>
                <input type="time" name={`end_${d}`} defaultValue={w?.[1] ?? "17:00"} step={900} aria-label={`${label} closes`} className="input w-32 tabular-nums" />
              </div>
            );
          })}
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="text-text-muted">Appointment length</span>
            <select name="slot_minutes" defaultValue={page.slotMinutes} className="input">
              {SLOT_CHOICES.map((m) => (
                <option key={m} value={m}>
                  {m === 60 ? "1 hour" : `${m} minutes`}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-text-muted">Time zone</span>
            <select name="timezone" defaultValue={page.tz} className="input">
              {zones.map(([z, name]) => (
                <option key={z} value={z}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-text-muted">Most per day</span>
            <input type="number" name="max_per_day" min={1} max={100} defaultValue={page.maxPerDay ?? ""} placeholder="No limit" className="input tabular-nums" />
          </label>
        </div>
        <label className="block space-y-1 text-sm">
          <span className="text-text-muted">Where (optional)</span>
          <input name="location" maxLength={300} defaultValue={page.location} placeholder="An address, “Phone call” or a video link" className="input" />
        </label>
        {q.error && ERRORS[q.error] && <p className="flag text-sm">{ERRORS[q.error]}</p>}
        {q.saved === "booking" && <p className="text-xs text-accent">Saved.</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg hover:bg-accent-dim">
            Save
          </button>
          <button type="submit" name="action" value="new-link" formNoValidate className="text-xs text-text-muted hover:text-text">
            Make a new link (the old one stops working)
          </button>
        </div>
      </form>
    </div>
  );
}
