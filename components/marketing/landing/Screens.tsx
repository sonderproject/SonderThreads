/**
 * Small drawings of Surfdesk screens for the landing-page demos, built from the
 * app's own tokens and components (card, tag, eyebrow). Sample data only; each
 * one mirrors what the real screen shows after that step.
 */

export function Frame({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="section-label">{title}</p>
        {right}
      </div>
      {children}
    </div>
  );
}

/** The command box with a sentence typed in. */
export function CommandLine({ text, mic = false }: { text: string; mic?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-bg px-4 py-3 shadow-sm">
      <span className="text-accent">/</span>
      <span className="min-w-0 flex-1 truncate text-sm text-text">{text}</span>
      {mic ? (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-bg">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-3.5 w-3.5">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        </span>
      ) : (
        <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-bg">Enter</span>
      )}
    </div>
  );
}

/** The green confirmation Surfdesk shows after a command. */
export function Done({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-bg-raised px-4 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-bg">✓</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-text">{title}</span>
        <span className="block truncate text-xs text-text-muted">{detail}</span>
      </span>
    </div>
  );
}

export function TaskRow({ title, when, tone = "tag-e", done = false, fresh = false }: { title: string; when?: string; tone?: string; done?: boolean; fresh?: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 ${fresh ? "border-accent" : "border-border-subtle"}`}>
      {done ? (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-accent text-[10px] text-bg">✓</span>
      ) : (
        <span className="h-4 w-4 shrink-0 rounded border border-border" />
      )}
      <span className={`min-w-0 flex-1 truncate text-sm ${done ? "text-text-muted line-through" : "text-text"}`}>{title}</span>
      {when && <span className={`tag ${tone} !ml-0 whitespace-nowrap`}>{when}</span>}
    </div>
  );
}

export function Person({ initials, name, sub }: { initials: string; name: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">{initials}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-text">{name}</span>
        {sub && <span className="block truncate text-xs text-text-muted">{sub}</span>}
      </span>
    </div>
  );
}

/** A person's history, newest first. `fresh` marks the line the step just added. */
export function Timeline({ items }: { items: { when: string; text: string; fresh?: boolean }[] }) {
  return (
    <ul className="space-y-1.5 border-l-2 border-border pl-3 text-xs">
      {items.map((i) => (
        <li key={i.when + i.text} className={i.fresh ? "font-medium text-text" : "text-text-muted"}>
          {i.fresh && <span className="mr-1.5 inline-block h-1.5 w-1.5 -translate-y-px rounded-full bg-accent" />}
          {i.when} · {i.text}
        </li>
      ))}
    </ul>
  );
}

export function Stats({ items }: { items: [string, string][] }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      {items.map(([n, l]) => (
        <div key={l} className="rounded-xl border border-border-subtle px-1 py-2">
          <p className="font-display text-xl font-light tabular-nums text-text">{n}</p>
          <p className="text-[10px] leading-tight text-text-muted">{l}</p>
        </div>
      ))}
    </div>
  );
}

export function Bars({ rows }: { rows: [string, number, string?][] }) {
  return (
    <div className="space-y-1.5">
      {rows.map(([label, w, value]) => (
        <div key={label} className="flex items-center gap-2 text-[11px] text-text-muted">
          <span className="w-24 shrink-0 truncate">{label}</span>
          <span className="h-1.5 rounded-full bg-accent" style={{ width: `${w}%` }} />
          {value && <span className="ml-auto tabular-nums text-text">{value}</span>}
        </div>
      ))}
    </div>
  );
}

export function MiniWeek({ day = 4, dots = [0, 2, 4, 5] }: { day?: number; dots?: number[] }) {
  return (
    <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-text-muted">
      {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
        <div key={i} className={`rounded-md py-1.5 ${i === day ? "bg-accent text-bg" : "bg-bg"}`}>
          {d}
          <div className="mt-0.5 flex h-1 justify-center">
            {dots.includes(i) && <span className={`h-1 w-1 rounded-full ${i === day ? "bg-bg" : "bg-accent"}`} />}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Chat({ lines }: { lines: { who: string; text: React.ReactNode; mine?: boolean }[] }) {
  return (
    <div className="space-y-1.5 text-xs">
      {lines.map((l, i) => (
        <p key={i} className={`rounded-xl px-3 py-2 ${l.mine ? "bg-accent-soft text-text" : "bg-bg text-text-muted"}`}>
          <strong className="text-text">{l.who}:</strong> {l.text}
        </p>
      ))}
    </div>
  );
}

export function Mention({ children }: { children: React.ReactNode }) {
  return <span className="font-medium text-accent">{children}</span>;
}
