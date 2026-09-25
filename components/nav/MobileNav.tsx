"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { CommandBar } from "@/components/command/CommandBar";
import { QuickActions } from "@/components/command/QuickActions";
import { ThemeToggle } from "@/components/nav/ThemeToggle";
import { logout } from "@/app/login/actions";
import { OPEN_SEARCH_EVENT } from "@/components/search/SearchPalette";
import { OPEN_COMMAND_EVENT, VOICE_STOP_EVENT, type OpenCommandDetail } from "@/components/command/Directory";
import { CalendarIcon, HomeIcon, MoreIcon, PeopleIcon, PlusIcon, TasksIcon } from "@/components/ui/icons";
import type { Person } from "@/lib/types";

const TABS = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/people", label: "People", Icon: PeopleIcon },
  { href: "/tasks", label: "Tasks", Icon: TasksIcon },
  { href: "/calendar", label: "Calendar", Icon: CalendarIcon },
];

const MORE_LINKS = [
  { href: "/lists", label: "Lists" },
  { href: "/notes", label: "Notes" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/**
 * Phone-only navigation: a bottom tab bar and a floating + button, both in
 * the thumb zone. Hidden from the sm breakpoint up, where the header nav is
 * shown instead.
 */
export function MobileNav({ people }: { people: Pick<Person, "id" | "display_name">[] }) {
  const pathname = usePathname();
  const [sheet, setSheet] = useState<"command" | "more" | null>(null);
  const [commandOpts, setCommandOpts] = useState<OpenCommandDetail & { key: number }>({ key: 0 });
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holding = useRef(false);
  const moreActive = MORE_LINKS.some((l) => isActive(pathname, l.href));

  function openCommand(opts: OpenCommandDetail = {}) {
    setCommandOpts({ ...opts, key: Date.now() });
    setSheet("command");
  }

  // Navigating away closes whatever sheet is open.
  useEffect(() => setSheet(null), [pathname]);

  useEffect(() => {
    const onOpen = (e: Event) => openCommand((e as CustomEvent<OpenCommandDetail>).detail ?? {});
    // "/" anywhere (outside a text field) opens the command bar.
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        openCommand();
      }
    };
    window.addEventListener(OPEN_COMMAND_EVENT, onOpen);
    window.addEventListener("keydown", onKey);

    // Entry points from the installed app: icon shortcuts (?voice=1, ?new=task)
    // and Android's share sheet (?compose=…, via /share).
    const params = new URLSearchParams(window.location.search);
    const newKind = params.get("new");
    const compose = params.get("compose");
    if (params.get("voice") || newKind || compose) {
      openCommand({
        voice: params.get("voice") === "1",
        compose: compose ?? undefined,
        followUp: newKind === "task" || newKind === "note" || newKind === "list" || newKind === "person" ? newKind : undefined,
      });
      window.history.replaceState(null, "", window.location.pathname);
    }

    return () => {
      window.removeEventListener(OPEN_COMMAND_EVENT, onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // + button: tap opens the command bar; press-and-hold talks.
  function onFabDown(e: React.PointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    holding.current = false;
    holdTimer.current = setTimeout(() => {
      holding.current = true;
      navigator.vibrate?.(15);
      openCommand({ voice: true, hold: true });
    }, 350);
  }

  function onFabUp() {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (holding.current) window.dispatchEvent(new Event(VOICE_STOP_EVENT));
    else openCommand();
    holding.current = false;
  }

  return (
    <>
      <button
        onPointerDown={onFabDown}
        onPointerUp={onFabUp}
        onPointerCancel={() => {
          if (holdTimer.current) clearTimeout(holdTimer.current);
          if (holding.current) window.dispatchEvent(new Event(VOICE_STOP_EVENT));
          holding.current = false;
        }}
        onContextMenu={(e) => e.preventDefault()}
        // Without this, lifting the finger also "clicks" whatever the sheet
        // just put under it.
        onTouchEnd={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openCommand();
          }
        }}
        aria-label="New command, note, task or person (hold to talk)"
        style={{ WebkitTouchCallout: "none", touchAction: "none" }}
        className="bottom-above-tabbar fixed right-4 z-30 flex h-14 w-14 select-none items-center justify-center rounded-full bg-accent text-bg shadow-lg shadow-black/40 active:scale-95 sm:hidden"
      >
        <PlusIcon className="h-7 w-7" />
      </button>

      <nav
        className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 backdrop-blur sm:hidden"
        aria-label="Main"
      >
        <div className="grid grid-cols-5">
          {TABS.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex h-16 flex-col items-center justify-center gap-0.5 font-mono text-xs ${
                  active ? "text-accent" : "text-text-muted"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon />
                {label}
              </Link>
            );
          })}
          <button
            onClick={() => setSheet("more")}
            className={`flex h-16 flex-col items-center justify-center gap-0.5 font-mono text-xs ${
              moreActive ? "text-accent" : "text-text-muted"
            }`}
          >
            <MoreIcon />
            More
          </button>
        </div>
      </nav>

      <Modal open={sheet === "command"} onClose={() => setSheet(null)} title="> command">
        <CommandBar
          key={commandOpts.key}
          autoFocus
          autoVoice={commandOpts.voice}
          holdToTalk={commandOpts.hold}
          initialValue={commandOpts.compose}
          initialFollowUp={commandOpts.followUp ? { kind: commandOpts.followUp } : null}
        />
        <QuickActions people={people} />
        <p className="mt-3 hidden font-mono text-xs text-text-faint sm:block">
          Tip: press / anywhere to open this · @ for people · # for lists
        </p>
      </Modal>

      <Modal open={sheet === "more"} onClose={() => setSheet(null)} title="More">
        <div className="divide-y divide-border-subtle rounded border border-border">
          <button
            onClick={() => {
              setSheet(null);
              window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
            }}
            className="flex h-12 w-full items-center px-4 text-left text-base text-text"
          >
            Search
          </button>
          {MORE_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="flex h-12 items-center px-4 text-base text-text">
              {l.label}
            </Link>
          ))}
          <a href="/api/export" className="flex h-12 items-center px-4 text-base text-text">
            Download backup
          </a>
          <div className="flex h-12 items-center justify-between px-4 text-base text-text">
            Theme
            <ThemeToggle />
          </div>
          <form action={logout}>
            <button type="submit" className="flex h-12 w-full items-center px-4 text-base text-danger">
              Sign out
            </button>
          </form>
        </div>
      </Modal>
    </>
  );
}
