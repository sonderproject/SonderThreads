"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Team chat, shown off: a #front-desk conversation that plays out message by message
 * when it scrolls into view, with a client tag, an @mention and a shared note, the way
 * Surfdesk's team messages work (components/messages). Sample data; decorative.
 */

type Msg = { who: string; initials: string; time: string; body: React.ReactNode; note?: string; mine?: boolean };

const Mention = ({ children }: { children: React.ReactNode }) => <span className="rounded bg-accent-soft px-1 font-medium text-accent">{children}</span>;
const ClientTag = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded px-1 font-medium" style={{ background: "var(--new-soft)", color: "var(--new)" }}>
    {children}
  </span>
);

const MESSAGES: Msg[] = [
  {
    who: "Maria G.",
    initials: "MG",
    time: "9:02",
    body: (
      <>
        Morning! <Mention>@Andre</Mention> can you call <ClientTag>#Ana Ortiz</ClientTag> back about Thursday?
      </>
    ),
  },
  { who: "Andre P.", initials: "AP", time: "9:04", body: "On it. Sharing my notes from her last visit.", note: "Prefers Saturday mornings. Bring the updated quote.", mine: true },
  { who: "Kim L.", initials: "KL", time: "9:05", body: "I can take her at 2:30 if Thursday doesn't work." },
  {
    who: "Maria G.",
    initials: "MG",
    time: "9:06",
    body: (
      <>
        Perfect. Thanks both. <Mention>@Kim</Mention> you&apos;re the backup.
      </>
    ),
  },
];

const CHANNELS = [
  { name: "general", unread: 0 },
  { name: "front-desk", unread: 0, active: true },
  { name: "admins-and-managers", unread: 2, locked: true },
];
const DIRECT = [
  { name: "Andre P.", online: true },
  { name: "Kim L.", online: false },
];

export function TeamChat() {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(MESSAGES.length);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    setShown(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        MESSAGES.forEach((_, i) => {
          timers.push(setTimeout(() => setTyping(true), 300 + i * 1500));
          timers.push(
            setTimeout(() => {
              setTyping(false);
              setShown(i + 1);
            }, 1100 + i * 1500),
          );
        });
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      timers.forEach(clearTimeout);
    };
  }, []);

  const next = MESSAGES[shown];
  return (
    <div ref={ref} className="card overflow-hidden p-0" aria-hidden>
      <div className="flex">
        <aside className="hidden w-48 shrink-0 space-y-4 border-r border-border-subtle p-4 sm:block">
          <div>
            <p className="eyebrow mb-2 text-text-faint">Channels</p>
            <ul className="space-y-0.5 text-sm">
              {CHANNELS.map((c) => (
                <li key={c.name} className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1 ${c.active ? "bg-accent-soft font-medium text-accent" : "text-text-muted"}`}>
                  <span className="flex min-w-0 items-center gap-1">
                    {c.locked ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3 shrink-0">
                        <rect x="5" y="11" width="14" height="9" rx="2" />
                        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                      </svg>
                    ) : (
                      <span>#</span>
                    )}
                    <span className="truncate">{c.name}</span>
                  </span>
                  {c.unread > 0 && <span className="tag tag-u !ml-0">{c.unread}</span>}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="eyebrow mb-2 text-text-faint">Direct</p>
            <ul className="space-y-0.5 text-sm text-text-muted">
              {DIRECT.map((d) => (
                <li key={d.name} className="flex items-center gap-2 px-2 py-1">
                  <span className={`h-2 w-2 rounded-full ${d.online ? "bg-accent" : "bg-border"}`} />
                  {d.name}
                </li>
              ))}
            </ul>
          </div>
        </aside>
        <div className="flex min-h-[380px] min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3">
            <p className="text-sm font-semibold text-text"># front-desk</p>
            <p className="text-xs text-text-muted">6 members</p>
          </div>
          <ul className="flex-1 space-y-4 px-5 py-4">
            {MESSAGES.slice(0, shown).map((m, i) => (
              <li key={i} className="flex gap-3 motion-safe:animate-[step-in_300ms_ease-out]">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${m.mine ? "bg-accent text-bg" : "bg-accent-soft text-accent"}`}
                >
                  {m.initials}
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="text-xs">
                    <span className="font-semibold text-text">{m.who}</span> <span className="tabular-nums text-text-faint">{m.time}</span>
                  </p>
                  <p className="text-sm leading-relaxed text-text">{m.body}</p>
                  {m.note && (
                    <div className="rounded-xl border border-border-subtle bg-bg px-3 py-2 text-xs">
                      <span className="eyebrow block text-text-faint">Shared note · Ana Ortiz</span>
                      <span className="text-text-muted">{m.note}</span>
                    </div>
                  )}
                </div>
              </li>
            ))}
            {typing && next && (
              <li className="flex items-center gap-2 text-xs text-text-muted">
                <span className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-1.5 w-1.5 animate-pulse rounded-full bg-text-muted" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </span>
                {next.who} is typing…
              </li>
            )}
          </ul>
          <div className="border-t border-border-subtle p-3">
            <div className="rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text-faint">Message #front-desk</div>
            <p className="mt-1.5 px-1 text-[11px] text-text-faint">Type # to tag a client, @ to mention a teammate.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
