import Link from "next/link";

const TABS = [
  { href: "/owner", label: "Overview" },
  { href: "/owner/accounts", label: "Accounts" },
  { href: "/owner/controls", label: "Controls" },
  { href: "/owner/growth", label: "Growth" },
  { href: "/owner/audience", label: "Audience" },
  { href: "/owner/inbox", label: "Inbox" },
  { href: "/owner/health", label: "Health" },
] as const;

/** Command center header and tabs (owner only; each page checks requireOwner() itself). */
export function OwnerNav({ active, title, intro }: { active: (typeof TABS)[number]["href"]; title: string; intro: string }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="eyebrow text-text-faint">Owner only</p>
        <h1 className="page-title">{title}</h1>
        <p className="text-sm text-text-muted">{intro}</p>
      </div>
      <nav aria-label="Command center" className="-mx-1 flex gap-1 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={t.href === active ? "page" : undefined}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${
              t.href === active ? "bg-accent font-semibold text-bg" : "text-text-muted hover:bg-bg-hover hover:text-text"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

/** A small stat tile. */
export function Tile({ label, value, note, urgent }: { label: string; value: string; note?: string; urgent?: boolean }) {
  return (
    <div className={`card space-y-1 p-4 ${urgent ? "flag-urgent" : ""}`}>
      <p className="eyebrow text-text-faint">{label}</p>
      <p className="font-display text-3xl font-light tabular-nums text-text">{value}</p>
      {note && <p className="text-xs text-text-muted">{note}</p>}
    </div>
  );
}

export function pct(n: number, d: number): string {
  return d > 0 ? `${Math.round((n / d) * 100)}%` : "—";
}

export function money(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

export function when(d: string | Date | null): string {
  if (!d) return "never";
  const ms = Date.now() - new Date(d).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
