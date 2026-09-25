"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { CommandBar } from "@/components/command/CommandBar";
import { QuickActions } from "@/components/command/QuickActions";
import { ThemeToggle } from "@/components/nav/ThemeToggle";
import { logout } from "@/app/login/actions";
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
  const moreActive = MORE_LINKS.some((l) => isActive(pathname, l.href));

  // Navigating away closes whatever sheet is open.
  useEffect(() => setSheet(null), [pathname]);

  return (
    <>
      <button
        onClick={() => setSheet("command")}
        aria-label="New command, note, task or person"
        className="bottom-above-tabbar fixed right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-bg shadow-lg shadow-black/40 active:scale-95 sm:hidden"
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
        <CommandBar autoFocus />
        <QuickActions people={people} />
      </Modal>

      <Modal open={sheet === "more"} onClose={() => setSheet(null)} title="More">
        <div className="divide-y divide-border-subtle rounded border border-border">
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
