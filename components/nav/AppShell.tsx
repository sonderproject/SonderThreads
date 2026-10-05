"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/nav/ThemeToggle";
import { logout } from "@/app/login/actions";
import { MobileNav } from "@/components/nav/MobileNav";
import { UndoProvider } from "@/components/ui/UndoToast";
import { SearchPalette, OPEN_SEARCH_EVENT } from "@/components/search/SearchPalette";
import type { Person } from "@/lib/types";
import { DirectoryProvider } from "@/components/command/Directory";
import { BellIcon } from "@/components/ui/icons";

const NAV_ITEMS = [
  { href: "/", label: "Command" },
  { href: "/people", label: "People" },
  { href: "/lists", label: "Lists" },
  { href: "/tasks", label: "Tasks" },
  { href: "/notes", label: "Notes" },
  { href: "/calendar", label: "Calendar" },
];

export function AppShell({
  children,
  people = [],
  lists = [],
  notificationCount = 0,
}: {
  children: React.ReactNode;
  notificationCount?: number;
  people?: Pick<Person, "id" | "display_name">[];
  lists?: { id: string; name: string }[];
}) {
  const pathname = usePathname();

  return (
    <DirectoryProvider value={{ people, lists }}>
      <UndoProvider>
        <div className="min-h-screen bg-bg">
          <header className="pt-safe sticky top-0 z-20 border-b border-border bg-bg/95 backdrop-blur">
            <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
              <Link href="/" className="font-mono text-lg text-accent">
                &gt; sonderthreads
              </Link>
              <div className="flex items-center">
                <div className="hidden items-center gap-2 sm:flex">
                  <nav className="flex gap-2">
                    {NAV_ITEMS.map((item) => {
                      const isActive =
                        item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`whitespace-nowrap rounded px-2.5 py-1.5 text-sm transition-colors ${
                            isActive
                              ? "bg-bg-hover text-text"
                              : "text-text-muted hover:text-text hover:bg-bg-hover"
                          }`}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </nav>
                  <button
                    onClick={() => window.dispatchEvent(new Event(OPEN_SEARCH_EVENT))}
                    title="Search (⌘K / Ctrl+K)"
                    className="rounded border border-border px-2 py-1 font-mono text-xs text-text-muted transition-colors hover:border-accent hover:text-text"
                  >
                    ⌘K
                  </button>
                  <a
                    href="/api/export"
                    title="Download a full backup of your data (JSON)"
                    className="rounded px-2 py-1.5 text-sm text-text-muted transition-colors hover:bg-bg-hover hover:text-text"
                  >
                    ⭳
                  </a>
                  <ThemeToggle />
                  <Link
                    href="/account"
                    title="Account"
                    aria-label="Account"
                    className="rounded px-2 py-1.5 text-sm text-text-muted transition-colors hover:bg-bg-hover hover:text-text"
                  >
                    ☺
                  </Link>
                  <form action={logout}>
                    <button
                      type="submit"
                      title="Sign out"
                      aria-label="Sign out"
                      className="rounded px-2 py-1.5 text-sm text-text-muted transition-colors hover:bg-bg-hover hover:text-text"
                    >
                      ⏻
                    </button>
                  </form>
                </div>
                <Link
                  href="/notifications"
                  title="Notifications"
                  aria-label={notificationCount ? `Notifications (${notificationCount})` : "Notifications"}
                  aria-current={pathname.startsWith("/notifications") ? "page" : undefined}
                  className={`relative -mr-1 rounded p-2 transition-colors hover:bg-bg-hover sm:ml-1 ${
                    pathname.startsWith("/notifications") ? "text-accent" : "text-text-muted hover:text-text"
                  }`}
                >
                  <BellIcon />
                  {notificationCount > 0 && (
                    <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-mono text-[10px] leading-none text-bg">
                      {notificationCount > 99 ? "99+" : notificationCount}
                    </span>
                  )}
                </Link>
              </div>
            </div>
          </header>
          <main className="pb-tabbar mx-auto max-w-4xl px-4 pt-5 sm:px-6 sm:py-6">{children}</main>
          <MobileNav people={people} />
          <SearchPalette />
        </div>
      </UndoProvider>
    </DirectoryProvider>
  );
}
