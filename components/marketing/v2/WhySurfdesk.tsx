/**
 * Homepage "Why Surfdesk": what's different, without naming other products.
 * Every point is a live feature (CLAUDE.md: never show what isn't live).
 */
const POINTS: { title: string; body: string; icon: React.ReactNode }[] = [
  {
    title: "Ready in minutes, not weekends",
    body: "Pick your line of work and your services come set up. Nothing to build.",
    icon: <path d="M13 3 5 14h6l-1 7 8-11h-6z" />,
  },
  {
    title: "Say it once. It's filed.",
    body: "Type or speak it. It becomes the task, note, reminder or client update.",
    icon: <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v4" />,
  },
  {
    title: "Built for people who work with people",
    body: "Clients, visits, follow-ups and a booking link, built in from day one.",
    icon: <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a5 5 0 0 1 10 0M11 20a5 5 0 0 1 10 0" />,
  },
  {
    title: "Reports that build themselves",
    body: "Impact numbers for funders, or revenue for your business. No spreadsheets.",
    icon: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  },
  {
    title: "Your team, with real privacy",
    body: "Roles, team chat linked to clients, and private chats admins can't read.",
    icon: <path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6zM9 12l2 2 4-4" />,
  },
  {
    title: "Your data stays yours",
    body: "Walled off, never sold, and you can export everything any time.",
    icon: <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />,
  },
];

export function WhySurfdesk() {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3">
      {POINTS.map((p) => (
        <div key={p.title} className="card flex flex-col gap-2 p-3 sm:flex-row sm:gap-3 sm:p-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent" aria-hidden>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              {p.icon}
            </svg>
          </span>
          <div className="min-w-0 space-y-0.5">
            <h3 className="text-sm font-semibold text-text">{p.title}</h3>
            <p className="text-xs leading-snug text-text-muted sm:text-sm">{p.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
