"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TaskRow } from "@/components/tasks/TaskRow";
import { PersonCard } from "@/components/people/PersonCard";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  dismissNotification,
  markNotificationsRead,
  undoTaskFromNote,
  type AppNotification,
  type UpcomingBirthday,
} from "@/lib/actions/notifications";
import type { Person, Task } from "@/lib/types";

const DAY = 86_400_000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function timeAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** "MM-DD" → "Today", "Tomorrow", or "Fri, Oct 10" for the next occurrence. */
function birthdayLabel(monthDay: string): { label: string; sort: number } {
  const [m, d] = monthDay.split("-").map(Number);
  const today = startOfDay(new Date());
  const now = new Date();
  let date = new Date(now.getFullYear(), m - 1, d).getTime();
  if (date < today - DAY) date = new Date(now.getFullYear() + 1, m - 1, d).getTime();
  const diff = Math.round((date - today) / DAY);
  const label =
    diff === 0
      ? "Today"
      : diff === 1
        ? "Tomorrow"
        : diff === -1
          ? "Yesterday"
          : new Date(date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return { label, sort: date };
}

export function NotificationsFeed({
  notifications,
  tasks,
  birthdays,
  needsAttention,
  personNames,
}: {
  notifications: AppNotification[];
  tasks: Task[];
  birthdays: UpcomingBirthday[];
  needsAttention: Person[];
  personNames: Record<string, string>;
}) {
  const router = useRouter();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  // Opening the page counts as reading everything on it; refresh so the bell clears.
  useEffect(() => {
    if (notifications.some((n) => !n.read_at)) {
      markNotificationsRead().then(() => router.refresh());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = startOfDay(new Date());
  const overdue = tasks.filter((t) => new Date(t.due_at!).getTime() < today);
  const dueToday = tasks.filter((t) => {
    const at = new Date(t.due_at!).getTime();
    return at >= today && at < today + DAY;
  });
  const comingUp = tasks.filter((t) => {
    const at = new Date(t.due_at!).getTime();
    return at >= today + DAY && at < today + 3 * DAY;
  });
  const visible = notifications.filter((n) => !hidden.has(n.id));
  const upcomingBirthdays = birthdays
    .map((b) => ({ ...b, ...birthdayLabel(b.month_day) }))
    .filter((b) => b.sort >= today - DAY && b.sort <= today + 7 * DAY)
    .sort((a, b) => a.sort - b.sort);

  function act(id: string, fn: () => Promise<void>) {
    setHidden((h) => new Set(h).add(id));
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  const nothing =
    !visible.length && !tasks.length && !upcomingBirthdays.length && !needsAttention.length;

  return (
    <div className="space-y-8">
      {nothing && <EmptyState message="You're all caught up." />}

      {overdue.length > 0 && <TaskGroup title="Overdue" tasks={overdue} personNames={personNames} />}
      {dueToday.length > 0 && <TaskGroup title="Due today" tasks={dueToday} personNames={personNames} />}

      {visible.length > 0 && (
        <Section title="Activity">
          <div className="divide-y divide-border-subtle rounded border border-border">
            {visible.map((n) => (
              <div key={n.id} className="flex items-start gap-3 px-3 py-3">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-accent"}`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  {n.href ? (
                    <Link href={n.href} className="text-sm text-text hover:text-accent">
                      {n.title}
                    </Link>
                  ) : (
                    <p className="text-sm text-text">{n.title}</p>
                  )}
                  <p className="mt-0.5 font-mono text-[11px] text-text-faint">
                    {[
                      n.body,
                      n.person_id && personNames[n.person_id],
                      timeAgo(n.created_at),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    {n.note_id && (
                      <>
                        {" · "}
                        <Link href={`/notes#${n.note_id}`} className="hover:text-accent">
                          view note
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {n.type === "task_from_note" && n.task_id && (
                    <button
                      onClick={() => act(n.id, () => undoTaskFromNote(n.id))}
                      className="rounded px-2 py-1 text-xs text-text-muted hover:bg-bg-hover hover:text-danger"
                    >
                      Undo
                    </button>
                  )}
                  <button
                    onClick={() => act(n.id, () => dismissNotification(n.id))}
                    className="rounded px-2 py-1 text-xs text-text-muted hover:bg-bg-hover hover:text-text"
                  >
                    {n.type === "task_from_note" ? "Keep" : "Dismiss"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {comingUp.length > 0 && <TaskGroup title="Coming up" tasks={comingUp} personNames={personNames} />}

      {upcomingBirthdays.length > 0 && (
        <Section title="Birthdays">
          <div className="divide-y divide-border-subtle rounded border border-border">
            {upcomingBirthdays.map((b) => (
              <Link
                key={b.id}
                href={`/people/${b.id}`}
                className="flex items-center justify-between px-3 py-3 text-sm text-text hover:bg-bg-hover"
              >
                {b.display_name}
                <span className="font-mono text-xs text-text-faint">{b.label}</span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {needsAttention.length > 0 && (
        <Section title="Needs attention">
          <div className="grid gap-2 sm:grid-cols-2">
            {needsAttention.map((p) => (
              <PersonCard key={p.id} person={p} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function TaskGroup({ title, tasks, personNames }: { title: string; tasks: Task[]; personNames: Record<string, string> }) {
  return (
    <Section title={title}>
      <div className="divide-y divide-border-subtle rounded border border-border">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} personName={t.person_id ? personNames[t.person_id] : null} />
        ))}
      </div>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 font-mono text-xs uppercase tracking-wide text-text-faint">{title}</h2>
      {children}
    </section>
  );
}
