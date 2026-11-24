
/**
 * "Not five different apps", as a picture: five generic app tiles, then Surfdesk.
 * Generic glyphs only, no other company's logos.
 */

const APPS: { label: string; tone: string; at: [number, number]; icon: React.ReactNode }[] = [
  {
    label: "Notes app",
    tone: "tag-e",
    at: [-1, -0.55],
    icon: <path d="M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 9h6M9 13h6M9 17h3" />,
  },
  {
    label: "Reminders",
    tone: "tag-u",
    at: [1, -0.6],
    icon: <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0" />,
  },
  {
    label: "Calendar",
    tone: "tag-n",
    at: [-1.15, 0.55],
    icon: <path d="M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM4 10h16M8 4v4M16 4v4" />,
  },
  {
    label: "Spreadsheet",
    tone: "tag-v",
    at: [1.15, 0.5],
    icon: <path d="M4 5h16v14H4zM4 10h16M4 15h16M10 5v14" />,
  },
  {
    label: "Texts",
    tone: "tag-e",
    at: [0, 1],
    icon: <path d="M20 12a7 7 0 0 1-10.3 6.2L5 19.5l1.3-4.2A7 7 0 1 1 20 12z" />,
  },
];

const ONE = ["Tasks", "Notes", "Lists", "Reminders", "Calendar", "Clients", "Team chat"];

function Tile({ app, size = 64, labelOpacity = 1 }: { app: (typeof APPS)[number]; size?: number; labelOpacity?: number }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className={`tag ${app.tone} !ml-0 flex items-center justify-center !rounded-2xl !p-0`} style={{ width: size, height: size }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-1/2 w-1/2" aria-hidden>
          {app.icon}
        </svg>
      </span>
      <span className="whitespace-nowrap text-xs text-text-muted" style={{ opacity: labelOpacity }}>
        {app.label}
      </span>
    </div>
  );
}

function SurfdeskTile({ size = 112 }: { size?: number }) {
  return (
    <span
      className="flex items-center justify-center rounded-[28px] border border-accent bg-bg-raised"
      style={{ width: size, height: size, boxShadow: "0 20px 60px -20px color-mix(in srgb, var(--accent) 55%, transparent)" }}
    >
      <span className="brand-mark h-12 w-[64px]" aria-hidden />
    </span>
  );
}

/**
 * Compact before/after strip (Nov 24, 2026): the scroll-driven fold left a near-empty
 * screen on phones and with reduced motion, so it's now one static band for everyone.
 */
export function AppFold() {
  return (
    <section className="bg-bg-raised px-4 py-14 sm:py-16">
      <div className="mx-auto max-w-5xl space-y-8 text-center">
        <div className="mx-auto max-w-3xl space-y-3">
          <p className="eyebrow text-text-faint">One app instead of five</p>
          <h2 className="font-display text-3xl font-light leading-tight tracking-[-0.02em] sm:text-5xl">
            Notes here. Reminders there. Clients in a spreadsheet. <span className="text-accent">Now it&apos;s one place.</span>
          </h2>
        </div>
        <div className="flex flex-col items-center justify-center gap-5 sm:flex-row sm:gap-8" role="img" aria-label="Five separate apps become Surfdesk">
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
            {APPS.map((a) => (
              <Tile key={a.label} app={a} size={52} />
            ))}
          </div>
          <span className="text-2xl text-text-muted sm:rotate-0" aria-hidden>
            <span className="hidden sm:inline">→</span>
            <span className="sm:hidden">↓</span>
          </span>
          <SurfdeskTile size={88} />
        </div>
        <div className="mx-auto flex max-w-xl flex-wrap justify-center gap-2">
          {ONE.map((x) => (
            <span key={x} className="rounded-full border border-border bg-bg px-3 py-1 text-xs text-text">
              {x}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
