"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Dot } from "@/components/calendar/CalendarItems";
import {
  addLinkedCalendar,
  removeLinkedCalendar,
  resetMyCalendarLink,
  updateLinkedCalendar,
  type LinkedCalendar,
} from "@/lib/actions/calendar";

const COLORS = [1, 2, 3, 4] as const;
const COLOR_NAMES = ["Teal", "Brown", "Green", "Slate"];

function ColorChoice({ value, onChange, name }: { value: number; onChange: (c: number) => void; name: string }) {
  return (
    <div role="radiogroup" aria-label={`Color for ${name}`} className="flex gap-2">
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={COLOR_NAMES[c - 1]}
          onClick={() => onChange(c)}
          className={`flex h-8 w-8 items-center justify-center rounded-full border ${
            value === c ? "border-text" : "border-transparent hover:border-border"
          }`}
        >
          <Dot color={`var(--cal-ext-${c})`} className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

function syncedLabel(c: LinkedCalendar): string {
  if (c.lastError) return c.lastError;
  if (!c.lastSyncedAt) return c.host;
  const mins = Math.round((Date.now() - Date.parse(c.lastSyncedAt)) / 60_000);
  const ago = mins < 2 ? "just now" : mins < 60 ? `${mins} min ago` : mins < 1440 ? `${Math.round(mins / 60)} hr ago` : `${Math.round(mins / 1440)} days ago`;
  return `${c.host} · updated ${ago}`;
}

/** Settings → Calendar: show outside calendars in Surfdesk, and subscribe to Surfdesk from them. */
export function CalendarSyncSettings({ linked, myLink }: { linked: LinkedCalendar[]; myLink: string }) {
  return (
    <>
      <LinkedCalendars linked={linked} />
      <SubscribeToSurfdesk initialLink={myLink} />
    </>
  );
}

function LinkedCalendars({ linked }: { linked: LinkedCalendar[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [color, setColor] = useState(linked.length % 4 + 1);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(null);
    startTransition(async () => {
      const result = await addLinkedCalendar({ name, url, color });
      if (!result.ok) return setError(result.error);
      setSaved(`${result.data.name} is linked. Its events now show on your calendar.`);
      setName("");
      setUrl("");
      setColor((linked.length + 1) % 4 + 1);
      router.refresh();
    });
  }

  return (
    <div className="card space-y-4 p-4">
      <div>
        <h3 className="text-sm font-semibold text-text">Show other calendars in Surfdesk</h3>
        <p className="text-xs text-text-muted">
          Google, Apple, Outlook, or Calendly and Cal.com bookings. Events show on your Surfdesk calendar and stay read-only.
          Surfdesk checks for changes every few minutes while you&apos;re looking.
        </p>
      </div>

      {linked.length > 0 && (
        <ul className="divide-y divide-border-subtle rounded-xl border border-border">
          {linked.map((c) => (
            <LinkedRow key={c.id} cal={c} />
          ))}
        </ul>
      )}

      <form onSubmit={add} className="space-y-3">
        {error && <p className="text-xs text-danger">{error}</p>}
        {saved && <p className="text-xs text-accent">{saved}</p>}
        <label className="block">
          <span className="eyebrow mb-1 block">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Work Google calendar" maxLength={80} required />
        </label>
        <label className="block">
          <span className="eyebrow mb-1 block">Private calendar link (iCal / .ics)</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="input"
            placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            required
          />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ColorChoice value={color} onChange={setColor} name="the new calendar" />
          <Button type="submit" disabled={pending || !name.trim() || !url.trim()}>
            {pending ? "Checking link..." : "Link calendar"}
          </Button>
        </div>
      </form>

      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-accent">Where do I find my calendar&apos;s link?</summary>
        <div className="mt-2 space-y-2 text-text-muted">
          <p>
            <strong className="text-text">Google Calendar</strong> (on a computer): Settings → under &quot;Settings for my
            calendars&quot; click the calendar → Integrate calendar → copy <em>Secret address in iCal format</em>.
          </p>
          <p>
            <strong className="text-text">Apple Calendar (iCloud)</strong>: tap ⓘ next to the calendar → turn on{" "}
            <em>Public Calendar</em> → Share Link → Copy. Anyone with that link can see the calendar, so keep it private.
          </p>
          <p>
            <strong className="text-text">Outlook</strong> (on the web): Settings → Calendar → Shared calendars → Publish a
            calendar → pick the calendar and &quot;Can view all details&quot; → Publish → copy the <em>ICS</em> link. Work
            accounts may have this turned off by IT.
          </p>
          <p>
            <strong className="text-text">Calendly or Cal.com</strong>: bookings land on the Google or Outlook calendar you
            connected there. Link that calendar here.
          </p>
        </div>
      </details>
    </div>
  );
}

function LinkedRow({ cal }: { cal: LinkedCalendar }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(cal.name);
  const [color, setColor] = useState(cal.color);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const r = await updateLinkedCalendar(cal.id, { name, color });
      if (!r.ok) return setError(r.error);
      setEditing(false);
      router.refresh();
    });
  }

  function remove() {
    if (!confirm(`Unlink ${cal.name}? Its events will stop showing in Surfdesk.`)) return;
    startTransition(async () => {
      const r = await removeLinkedCalendar(cal.id);
      if (!r.ok) return setError(r.error);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <li className="space-y-3 p-3">
        {error && <p className="text-xs text-danger">{error}</p>}
        <input value={name} onChange={(e) => setName(e.target.value)} className="input" maxLength={80} aria-label="Calendar name" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ColorChoice value={color} onChange={setColor} name={cal.name} />
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={pending || !name.trim()}>
              Save
            </Button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="grid grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-3 p-3">
      <Dot color={`var(--cal-ext-${cal.color})`} className="h-3 w-3" />
      <div className="min-w-0">
        <p className="truncate text-sm text-text">{cal.name}</p>
        <p className={`text-xs ${cal.lastError ? "text-urgent" : "truncate text-text-muted"}`}>{syncedLabel(cal)}</p>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
      <div className="flex gap-1">
        <button type="button" onClick={() => setEditing(true)} className="rounded-full px-2.5 py-1 text-xs font-medium text-accent hover:bg-bg-hover">
          Edit
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="rounded-full px-2.5 py-1 text-xs font-medium text-danger hover:bg-bg-hover"
        >
          Unlink
        </button>
      </div>
    </li>
  );
}

function SubscribeToSurfdesk({ initialLink }: { initialLink: string }) {
  const [link, setLink] = useState(initialLink);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const webcal = link.replace(/^https?:\/\//, "webcal://");
  const google = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy. Select the link and copy it yourself.");
    }
  }

  function reset() {
    if (!confirm("Make a new link? Calendars subscribed with the old one will stop updating until you subscribe again.")) return;
    setError(null);
    startTransition(async () => {
      const r = await resetMyCalendarLink();
      if (!r.ok) return setError(r.error);
      setLink(r.data);
      setNotice("New link made. The old one no longer works.");
    });
  }

  return (
    <div className="card space-y-4 p-4">
      <div>
        <h3 className="text-sm font-semibold text-text">See Surfdesk in Google, Apple or Outlook</h3>
        <p className="text-xs text-text-muted">
          Subscribe to this private link and your open Surfdesk tasks show up in your other calendar. It includes task titles
          and due times only, never notes. Google can take several hours to pick up changes.
        </p>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      {notice && <p className="text-xs text-accent">{notice}</p>}
      <div className="flex gap-2">
        <input value={link} readOnly onFocus={(e) => e.currentTarget.select()} className="input font-mono !text-xs" aria-label="Your private calendar link" />
        <Button type="button" variant="ghost" onClick={copy} className="shrink-0">
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <a href={google} target="_blank" rel="noopener noreferrer" className="rounded-full border border-border px-3 py-1.5 text-sm font-medium text-text hover:bg-bg-hover">
          Add to Google Calendar
        </a>
        <a href={webcal} className="rounded-full border border-border px-3 py-1.5 text-sm font-medium text-text hover:bg-bg-hover">
          Add to Apple Calendar
        </a>
      </div>
      <p className="text-xs text-text-muted">
        Outlook: Add calendar → Subscribe from web → paste the link. Anyone with this link can see these items, so don&apos;t share
        it.{" "}
        <button type="button" onClick={reset} disabled={pending} className="font-medium text-accent hover:underline">
          {pending ? "Making a new link..." : "Make a new link"}
        </button>
      </p>
    </div>
  );
}
