import Link from "next/link";
import type { ChecklistItem } from "@/lib/org-checklist";
import { dismissOrgChecklist } from "@/lib/actions/org";

/** Team page, admins: "Finish setting up" with a progress bar; each item links to where it's done. */
export function OrgChecklist({ items }: { items: ChecklistItem[] }) {
  const done = items.filter((i) => i.done).length;
  return (
    <section className="card space-y-3 p-5" aria-label="Finish setting up">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-text">Finish setting up</p>
        <p className="text-xs text-text-muted tabular-nums">
          {done} of {items.length} done
        </p>
      </div>
      <div className="progress-bar" aria-hidden>
        <span style={{ width: `${Math.round((done / items.length) * 100)}%` }} />
      </div>
      <ul className="space-y-1">
        {items.map((i) => (
          <li key={i.key}>
            <Link href={i.href} className="flex items-start gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-bg-hover">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                  i.done ? "border-accent bg-accent text-bg" : "border-border text-transparent"
                }`}
                aria-hidden
              >
                ✓
              </span>
              <span className="min-w-0">
                <span className={`block text-sm ${i.done ? "text-text-muted line-through" : "font-medium text-text"}`}>{i.label}</span>
                {!i.done && <span className="block text-xs text-text-muted">{i.hint}</span>}
              </span>
              <span className="sr-only">{i.done ? "(done)" : "(to do)"}</span>
            </Link>
          </li>
        ))}
      </ul>
      <form action={dismissOrgChecklist} className="text-right">
        <button type="submit" className="text-xs text-text-muted hover:text-text">
          Hide this list
        </button>
      </form>
    </section>
  );
}
