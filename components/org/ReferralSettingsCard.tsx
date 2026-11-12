import { saveReferralSettings } from "@/lib/actions/referrals";
import { US_ZONES } from "@/lib/time-zones";
import type { ReferralSettings } from "@/lib/referral-settings";
import { SLOT_CHOICES } from "@/lib/referral-slots";

const DAYS = [
  [1, "Monday"],
  [2, "Tuesday"],
  [3, "Wednesday"],
  [4, "Thursday"],
  [5, "Friday"],
  [6, "Saturday"],
  [0, "Sunday"],
] as const;

const ZONES = US_ZONES;

/** Admin: when referred clients can book, how many to take, and the services partners can pick. */
export function ReferralSettingsCard({ settings }: { settings: ReferralSettings }) {
  const zones = ZONES.some(([z]) => z === settings.tz) ? ZONES : ([[settings.tz, settings.tz], ...ZONES] as const);
  return (
    <form action={saveReferralSettings} id="referral-settings" className="card scroll-mt-20 space-y-5 p-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-text">Referral settings</p>
        <p className="text-xs text-text-muted">
          Partners pick an appointment time when they refer someone. Times are shown in your organization&apos;s time zone.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="appointments" value="1" defaultChecked={settings.appointments} className="h-4 w-4 accent-[var(--accent)]" />
        Let partners book an appointment
      </label>

      <fieldset className="space-y-2">
        <legend className="eyebrow mb-1 text-text-faint">Open hours</legend>
        {DAYS.map(([d, label]) => {
          const w = settings.hours[String(d)]?.[0];
          return (
            <div key={d} className="flex flex-wrap items-center gap-2 text-sm">
              <label className="flex w-32 items-center gap-2">
                <input type="checkbox" name={`open_${d}`} value="1" defaultChecked={Boolean(w)} className="h-4 w-4 accent-[var(--accent)]" />
                {label}
              </label>
              <input type="time" name={`start_${d}`} defaultValue={w?.[0] ?? "10:00"} step={900} aria-label={`${label} opens`} className="input w-32 tabular-nums" />
              <span className="text-text-muted">to</span>
              <input type="time" name={`end_${d}`} defaultValue={w?.[1] ?? "13:00"} step={900} aria-label={`${label} closes`} className="input w-32 tabular-nums" />
            </div>
          );
        })}
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-text-muted">Appointment length</span>
          <select name="slot_minutes" defaultValue={settings.slotMinutes} className="input">
            {SLOT_CHOICES.map((m) => (
              <option key={m} value={m}>
                {m === 60 ? "1 hour" : `${m} minutes`}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-text-muted">Time zone</span>
          <select name="timezone" defaultValue={settings.tz} className="input">
            {zones.map(([z, name]) => (
              <option key={z} value={z}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="space-y-2">
        <legend className="eyebrow mb-1 text-text-faint">Referral limits (optional)</legend>
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              ["max_day", "Per day", settings.caps.day],
              ["max_week", "Per week", settings.caps.week],
              ["max_month", "Per month", settings.caps.month],
            ] as const
          ).map(([name, label, value]) => (
            <label key={name} className="space-y-1 text-sm">
              <span className="text-text-muted">{label}</span>
              <input type="number" name={name} min={1} max={10000} defaultValue={value ?? ""} placeholder="No limit" className="input tabular-nums" />
            </label>
          ))}
        </div>
        <p className="text-xs text-text-muted">
          Limits never turn anyone away. When you&apos;re full, the form still sends, and the partner is told the client will
          get the next available appointment.
        </p>
      </fieldset>

      <label className="block space-y-1 text-sm">
        <span className="eyebrow text-text-faint">Services you offer</span>
        <textarea
          name="services"
          rows={4}
          defaultValue={settings.services.join("\n")}
          placeholder={"One per line, e.g.\nJob search\nHousing\nTraining"}
          className="input"
        />
        <span className="block text-xs text-text-muted">Partners tick which ones the client needs.</span>
      </label>

      <button type="submit" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg hover:bg-accent-dim">
        Save referral settings
      </button>
    </form>
  );
}
