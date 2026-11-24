import Link from "next/link";

/** One place for numbers (Business): the full Impact/Insights story, your dashboard, and scheduled emails. */
export function InsightsTabs({ current }: { current: "overview" | "dashboard" | "scheduled" }) {
  const tabs = [
    ["overview", "Overview", "/impact"],
    ["dashboard", "Dashboard", "/reports"],
    ["scheduled", "Scheduled", "/reports?tab=scheduled"],
  ] as const;
  return (
    <nav className="inline-flex rounded-full border border-border bg-bg-raised p-0.5 text-sm" aria-label="Insights sections">
      {tabs.map(([k, label, href]) => (
        <Link
          key={k}
          href={href}
          aria-current={current === k ? "page" : undefined}
          className={`rounded-full px-4 py-1.5 ${current === k ? "bg-accent text-bg" : "text-text-muted hover:text-text"}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
