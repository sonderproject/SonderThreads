import type { Metadata } from "next";
import { FormMemory } from "@/components/referrals/FormMemory";
import { submitBooking } from "@/lib/actions/booking";
import { bookingPageByCode, openBookingSlots } from "@/lib/booking";
import { formatSlot } from "@/lib/referral-slots";
import { getAppSettings, inMaintenance } from "@/lib/app-settings";
import { dayKey } from "@/lib/tz";

export const metadata: Metadata = { title: "Book a time", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  name: "Enter your name.",
  email: "That email address doesn't look right.",
  contact: "Enter an email or a phone number so they can reach you.",
  slot: "Choose a time.",
  taken: "Someone just booked that time. Please choose another; everything else you entered is still here.",
  busy: "Too many bookings from this device just now. Please try again in a little while.",
  many: "You already have a few upcoming bookings here. Reply to a confirmation email to change one.",
};

/** Public booking page (no sign-in): pick an open time and leave your details. */
export default async function BookPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ booked?: string; error?: string; at?: string }> }) {
  const { code } = await params;
  const { booked, error, at } = await searchParams;
  const page = await bookingPageByCode(code);
  const paused = error === "paused" || inMaintenance(await getAppSettings());
  const open = page && !paused && !booked ? await openBookingSlots(page) : [];
  const days = new Map<string, Date[]>();
  for (const t of open.slice(0, 200)) {
    const k = dayKey(t, page!.tz);
    days.set(k, [...(days.get(k) ?? []), t]);
  }
  const zoneName = page
    ? new Intl.DateTimeFormat("en-US", { timeZone: page.tz, timeZoneName: "short" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value
    : "";
  const bookedLabel = at && /^\d{10,14}$/.test(at) && page ? formatSlot(new Date(Number(at)), page.tz) : null;

  return (
    <div className="min-h-screen bg-bg px-4 py-10 text-text">
      <main className="mx-auto max-w-md space-y-6">
        {!page || error === "closed" ? (
          <div className="card space-y-2 p-6 text-center">
            <h1 className="page-title">Link not active</h1>
            <p className="text-sm text-text-muted">This booking link isn&apos;t active. Ask the person who shared it for a new one.</p>
          </div>
        ) : paused ? (
          <div className="card space-y-2 p-6 text-center">
            <h1 className="page-title">Back in a few minutes</h1>
            <p className="text-sm text-text-muted">Booking is paused for a quick update. Please try this link again shortly.</p>
          </div>
        ) : booked ? (
          <>
            <div className="card space-y-3 p-6 text-center">
              <p className="font-display text-xl">You&apos;re booked.</p>
              {bookedLabel && (
                <p className="text-sm text-text">
                  <strong>{bookedLabel}</strong> ({zoneName}) with {page.ownerName}.
                </p>
              )}
              {page.location && (
                <p className="text-sm text-text">
                  Where: <strong>{page.location}</strong>
                </p>
              )}
              <p className="text-xs text-text-muted">If you left an email, a confirmation is on its way. Reply to it to make changes.</p>
              <FormMemory storageKey={`booking:${code}`} restore={false} clear />
            </div>
            <a href="/get-started?utm_source=booking&utm_medium=thankyou" className="card block space-y-1 p-4 text-left transition-colors hover:bg-bg-hover">
              <span className="block text-sm font-semibold text-text">Want a booking page like this?</span>
              <span className="block text-xs text-text-muted">Surfdesk keeps every customer, follow-up and booking organized. Try it free →</span>
            </a>
          </>
        ) : (
          <>
            <div className="space-y-1 text-center">
              <p className="eyebrow text-text-faint">{page.ownerName}</p>
              <h1 className="page-title">{page.title}</h1>
              {page.location && <p className="text-sm text-text-muted">{page.location}</p>}
            </div>
            <form action={submitBooking} data-memory={`booking:${code}`} className="card space-y-5 p-5">
              <FormMemory storageKey={`booking:${code}`} restore={Boolean(error)} clear={false} />
              <input type="hidden" name="code" value={code} />
              <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label>
                  Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>
              {error && ERRORS[error] && <p className="flag text-sm">{ERRORS[error]}</p>}

              <fieldset className="space-y-2">
                <legend className="section-label mb-1">Pick a time</legend>
                {open.length === 0 ? (
                  <p className="rounded-xl border border-border-subtle p-3 text-sm text-text-muted">
                    No open times in the next two weeks. Please check back later.
                  </p>
                ) : (
                  <select name="at" required defaultValue="" className="input">
                    <option value="" disabled>
                      Choose a time ({zoneName})
                    </option>
                    {[...days.entries()].map(([k, times]) => (
                      <optgroup key={k} label={formatSlot(times[0], page.tz).split(" · ")[0]}>
                        {times.map((t) => (
                          <option key={t.getTime()} value={t.getTime()}>
                            {formatSlot(t, page.tz)}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                )}
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="section-label mb-1">Your details</legend>
                <input name="name" required maxLength={120} autoComplete="name" placeholder="Your name" className="input" />
                <input name="email" type="email" maxLength={254} autoComplete="email" placeholder="Email (for your confirmation)" className="input" />
                <input name="phone" type="tel" maxLength={40} autoComplete="tel" placeholder="Phone (optional if you gave an email)" className="input" />
                <textarea name="note" rows={3} maxLength={1000} placeholder="Anything they should know? (optional)" className="input" />
              </fieldset>

              <p className="text-xs text-text-muted">
                Your details go only to {page.ownerName} to arrange your appointment. Please don&apos;t include ID numbers, medical or financial
                details. See our{" "}
                <a href="/privacy" className="underline">
                  privacy policy
                </a>
                .
              </p>
              <button
                type="submit"
                disabled={open.length === 0}
                className="w-full rounded-full bg-accent px-6 py-3 text-sm font-semibold text-bg hover:bg-accent-dim disabled:opacity-50"
              >
                Book it
              </button>
            </form>
            <p className="text-center text-xs text-text-faint">
              <a href="/get-started?utm_source=booking&utm_medium=page" className="hover:text-text">
                Booking by Surfdesk
              </a>
            </p>
          </>
        )}
      </main>
    </div>
  );
}
