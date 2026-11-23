import { MiniCalendar } from "@/components/calendar/MiniCalendar";
import { PersonCard } from "@/components/people/PersonCard";
import { BellIcon, CalendarIcon, HomeIcon, MicIcon, MoreIcon, PeopleIcon, SendIcon, TasksIcon } from "@/components/ui/icons";
import { buildWeeks } from "@/lib/calendar-utils";
import type { Person } from "@/lib/types";
import { ScaleFrame } from "./ScaleFrame";

/**
 * Landing hero: the Surfdesk dashboard on a laptop and a phone, drawn with the app's own
 * layout, tokens and components (MiniCalendar, PersonCard), filled with sample data.
 * Decorative: hidden from screen readers and not clickable.
 */

const HOUR = 3600e3;
const DAY = 24 * HOUR;

function person(id: string, name: string, opts: { createdAgo: number; activeAgo: number; followUp?: boolean }): Person {
  const [first, ...rest] = name.split(" ");
  const now = Date.now();
  return {
    id,
    user_id: "sample",
    first_name: first,
    last_name: rest.join(" ") || null,
    display_name: name,
    phone: null,
    email: null,
    birthday: null,
    status: null,
    current_status: null,
    next_action: null,
    summary: null,
    needs_followup: !!opts.followUp,
    ethnicity: null,
    income_level: null,
    gender: null,
    created_at: new Date(now - opts.createdAgo).toISOString(),
    updated_at: new Date(now - opts.activeAgo).toISOString(),
    last_activity_at: new Date(now - opts.activeAgo).toISOString(),
    deleted_at: null,
  };
}

const PEOPLE = [
  person("ana", "Ana Ortiz", { createdAgo: 1 * DAY, activeAgo: 2 * HOUR }),
  person("marcus", "Marcus Cole", { createdAgo: 40 * DAY, activeAgo: 3 * DAY, followUp: true }),
  person("sarah", "Sarah Kim", { createdAgo: 90 * DAY, activeAgo: 26 * HOUR }),
];

const TODAY = [
  { title: "Send the proposal", tag: "10:00 AM", tone: "tag-e" },
  { title: "Follow up with Marcus", tag: "Overdue", tone: "tag-u" },
  { title: "Ana – color appointment", tag: "2:30 PM", tone: "tag-n" },
  { title: "Groceries: milk, eggs, coffee", tag: "List", tone: "" },
];

const NAV = ["Command", "People", "Lists", "Tasks", "Notes", "Visits", "Calendar", "Insights", "Messages"];

function CommandBox({ text, action, details, compact = false }: { text: string; action: string; details: string; compact?: boolean }) {
  return (
    <div>
      <div className="flex items-end gap-2 rounded border border-accent bg-bg-raised py-2 pl-4 pr-2">
        <span className="pb-2 tabular-nums text-accent">&gt;</span>
        <span className={`flex-1 py-1.5 tabular-nums text-text ${compact ? "text-[15px]" : "text-sm"}`}>
          {text}
          <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 bg-accent" />
        </span>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-text-muted">
          <MicIcon />
        </span>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-bg">
          <SendIcon />
        </span>
      </div>
      <p className="mt-2 truncate tabular-nums text-sm text-text-muted">
        <span className="text-accent">→ {action}</span> {details}
      </p>
    </div>
  );
}

function TaskList({ rows }: { rows: typeof TODAY }) {
  return (
    <div className="card divide-y divide-border-subtle">
      {rows.map((t) => (
        <div key={t.title} className="flex items-center gap-3 px-4 py-3">
          <span className="h-5 w-5 shrink-0 rounded-full border-2 border-border" />
          <span className="min-w-0 flex-1 truncate text-sm text-text">{t.title}</span>
          {t.tone ? <span className={`tag ${t.tone}`}>{t.tag}</span> : <span className="text-xs text-text-faint">{t.tag}</span>}
        </div>
      ))}
    </div>
  );
}

function Label({ children, more = true }: { children: React.ReactNode; more?: boolean }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h3 className="section-label">{children}</h3>
      {more && <span className="text-xs text-text-muted">view all</span>}
    </div>
  );
}

function Desktop() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const todayKey = `${year}-${String(month).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const weeks = buildWeeks(year, month, todayKey);
  const eventDays = new Set([3, 7, 8, 12, 15, 19, 22, 26, now.getDate(), Math.min(now.getDate() + 2, 28)]);
  return (
    <div className="flex h-full flex-col bg-bg">
      <div className="glass flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="brand-mark h-7 w-[37px]" />
          <nav className="flex gap-1">
            {NAV.map((n, i) => (
              <span key={n} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${i === 0 ? "bg-accent-soft font-medium text-accent" : "text-text-muted"}`}>
                {n}
              </span>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2 text-text-muted">
          <span className="rounded-full border border-border px-2.5 py-1 tabular-nums text-xs">⌘K</span>
          <span className="relative p-2">
            <BellIcon />
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-urgent" />
          </span>
        </div>
      </div>
      <div className="mx-auto w-full max-w-[760px] flex-1 space-y-6 px-6 py-6">
        <CommandBox text="Remind me to send the proposal Friday at 10" action="reminder" details={"\"Send the proposal\" · Fri · 10:00 AM"} />
        <section>
          <Label>Calendar</Label>
          <div className="grid grid-cols-2 gap-3">
            <MiniCalendar year={year} month={month} weeks={weeks} eventDays={eventDays} />
            <div className="card flex flex-col justify-between gap-3 p-4">
              <div>
                <p className="eyebrow text-text-faint">Up next</p>
                <p className="mt-1 font-display text-2xl font-light">Ana – color</p>
                <p className="text-sm text-text-muted">Today · 2:30 PM</p>
              </div>
              <div className="space-y-1.5 text-xs text-text-muted">
                <p>
                  <span className="text-accent">●</span> 4 things due today
                </p>
                <p>
                  <span className="text-urgent">●</span> 1 overdue follow-up
                </p>
              </div>
            </div>
          </div>
        </section>
        <section>
          <Label more={false}>Today</Label>
          <TaskList rows={TODAY} />
        </section>
        <section>
          <Label>People</Label>
          <div className="grid grid-cols-3 gap-2">
            {PEOPLE.map((p) => (
              <PersonCard key={p.id} person={p} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Phone() {
  return (
    <div className="flex h-full flex-col bg-bg">
      <div className="flex items-center justify-between px-7 pb-1 pt-4 text-[13px] font-semibold text-text">
        <span>9:41</span>
        <span className="h-6 w-24 rounded-full bg-text" />
        <span className="tabular-nums">100%</span>
      </div>
      <div className="glass flex items-center justify-between border-b px-5 py-3">
        <span className="brand-mark h-6 w-[32px]" />
        <span className="relative text-text-muted">
          <BellIcon />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-urgent" />
        </span>
      </div>
      <div className="flex-1 space-y-5 px-4 py-4">
        <CommandBox text="Ana – haircut $45" action="log service" details="Haircut · Ana Ortiz · $45" compact />
        <section>
          <Label more={false}>Today</Label>
          <TaskList rows={TODAY.slice(0, 3)} />
        </section>
        <section>
          <Label>People</Label>
          <div className="space-y-2">
            <PersonCard person={PEOPLE[0]} />
            <PersonCard person={PEOPLE[1]} />
          </div>
        </section>
      </div>
      <div className="glass grid grid-cols-5 border-t px-2 pb-6 pt-2 text-[10px] text-text-muted">
        {[
          ["Home", HomeIcon],
          ["People", PeopleIcon],
          ["Tasks", TasksIcon],
          ["Calendar", CalendarIcon],
          ["More", MoreIcon],
        ].map(([label, Icon], i) => {
          const I = Icon as typeof HomeIcon;
          return (
            <span key={label as string} className={`flex flex-col items-center gap-0.5 ${i === 0 ? "text-accent" : ""}`}>
              <I className="h-6 w-6" />
              {label as string}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Float({ className, delay, children }: { className: string; delay: string; children: React.ReactNode }) {
  return (
    <div
      className={`absolute z-10 rounded-2xl border border-border bg-bg-raised px-4 py-3 shadow-[var(--shadow-card)] motion-safe:animate-[float-y_6s_ease-in-out_infinite] ${className}`}
      style={{ animationDelay: delay }}
      aria-hidden
    >
      {children}
    </div>
  );
}

function Check({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm text-bg">✓</span>
      <span>
        <span className="block whitespace-nowrap text-sm font-semibold text-text">{title}</span>
        <span className="block whitespace-nowrap text-xs text-text-muted">{sub}</span>
      </span>
    </div>
  );
}

export function ProductHero() {
  return (
    <div className="relative mx-auto max-w-5xl pb-6 pt-4 text-left sm:pb-12">
      {/* soft accent glow behind the devices */}
      <div
        className="pointer-events-none absolute inset-x-10 top-10 bottom-0 -z-0 rounded-[48px] blur-3xl"
        style={{ background: "radial-gradient(60% 60% at 50% 40%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 70%)" }}
        aria-hidden
      />
      {/* laptop (tablets and up) */}
      <div className="relative mr-[18%] hidden sm:block">
        <div className="rounded-[18px] border border-border bg-bg-raised p-2 shadow-[var(--shadow-card)] sm:rounded-[22px] sm:p-3">
          <div className="mb-2 flex items-center gap-1.5 px-1">
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
            <span className="mx-auto hidden rounded-full bg-bg px-10 py-1 text-[10px] text-text-muted sm:block">thesurfdesk.app</span>
          </div>
          <ScaleFrame width={1120} height={720} className="rounded-xl border border-border-subtle">
            <Desktop />
          </ScaleFrame>
        </div>
      </div>
      {/* phone: the whole hero on phones, beside the laptop from tablets up */}
      <div className="relative mx-auto w-[78%] max-w-[300px] sm:absolute sm:bottom-0 sm:right-0 sm:mx-0 sm:w-[27%] sm:max-w-[260px]">
        <div className="rounded-[28px] border border-border bg-bg-raised p-1.5 shadow-[var(--shadow-card)] sm:rounded-[40px] sm:p-2">
          <ScaleFrame width={390} height={800} className="rounded-[22px] border border-border-subtle sm:rounded-[32px]">
            <Phone />
          </ScaleFrame>
        </div>
      </div>
      {/* floating results */}
      <Float className="-left-2 top-[44%] hidden md:block lg:-left-10" delay="0s">
        <Check title="Reminder set" sub="Send the proposal · Fri 10:00 AM" />
      </Float>
      <Float className="right-[24%] top-[4%] hidden lg:block" delay="1.5s">
        <Check title="Visit logged" sub="Haircut · $45 · Ana Ortiz" />
      </Float>
      <Float className="-left-2 bottom-[6%] hidden md:block lg:-left-14" delay="3s">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
            <BellIcon className="h-4 w-4" />
          </span>
          <span>
            <span className="block whitespace-nowrap text-sm font-semibold text-text">Follow up with Marcus</span>
            <span className="block whitespace-nowrap text-xs text-text-muted">3 days since you last talked</span>
          </span>
        </div>
      </Float>
    </div>
  );
}
