"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/nav/ThemeToggle";
import { logout } from "@/app/login/actions";
import { MobileNav } from "@/components/nav/MobileNav";
import { WakeOnReturn } from "@/components/nav/WakeOnReturn";
import { IdleSignOut } from "@/components/nav/IdleSignOut";
import { UndoProvider } from "@/components/ui/UndoToast";
import { SearchPalette, OPEN_SEARCH_EVENT } from "@/components/search/SearchPalette";
import type { Person } from "@/lib/types";
import { DirectoryProvider } from "@/components/command/Directory";
import { BellIcon, DownloadIcon, SignOutIcon, UserIcon } from "@/components/ui/icons";

const NAV_ITEMS = [
  { href: "/", label: "Command" },
  { href: "/people", label: "People" },
  { href: "/lists", label: "Lists" },
  { href: "/tasks", label: "Tasks" },
  { href: "/notes", label: "Notes" },
  { href: "/check-ins", label: "Check-ins" },
  { href: "/calendar", label: "Calendar" },
];

export function AppShell({
  children,
  people = [],
  lists = [],
  notificationCount = 0,
  idleMinutes = 30,
  showTeam = false,
}: {
  /** Organization admins and supervisors get a Team tab. */
  showTeam?: boolean;
  children: React.ReactNode;
  /** Auto sign-out after this many idle minutes; null = stay signed in (Settings → Privacy & security). */
  idleMinutes?: number | null;
  notificationCount?: number;
  people?: Pick<Person, "id" | "display_name">[];
  lists?: { id: string; name: string }[];
}) {
  const pathname = usePathname();

  return (
    <DirectoryProvider value={{ people, lists }}>
      <UndoProvider>
        <WakeOnReturn />
        <IdleSignOut minutes={idleMinutes} />
        <div className="min-h-screen bg-bg">
          <header className="glass pt-safe sticky top-0 z-20 border-b">
            <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
              <Link href="/" aria-label="Sonder Threads home" title="Sonder Threads" className="-ml-1 mr-6 flex shrink-0 items-center py-1 sm:-ml-2">
                <span className="brand-mark h-7 w-[37px]" aria-hidden />
              </Link>
              <div className="flex items-center">
                <div className="hidden items-center gap-2 sm:flex">
                  <nav className="flex gap-1">
                    {[...NAV_ITEMS, ...(showTeam ? [{ href: "/team", label: "Team" }] : [])].map((item) => {
                      const isActive =
                        item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-colors ${
                            isActive
                              ? "bg-accent-soft font-medium text-accent"
                              : "text-text-muted hover:bg-bg-hover hover:text-text"
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
                    className="ml-1 rounded-full border border-border px-2.5 py-1 tabular-nums text-xs text-text-muted transition-colors hover:border-accent hover:text-text"
                  >
                    ⌘K
                  </button>
                  <a
                    href="/api/export"
                    title="Download a full backup of your data (JSON)"
                    aria-label="Download backup"
                    className="rounded-full p-2 text-text-muted transition-colors hover:bg-bg-hover hover:text-text"
                  >
                    <DownloadIcon />
                  </a>
                  <ThemeToggle />
                  <Link
                    href="/settings"
                    title="Settings"
                    aria-label="Settings"
                    className="rounded-full p-2 text-text-muted transition-colors hover:bg-bg-hover hover:text-text"
                  >
                    <UserIcon />
                  </Link>
                  <form action={logout}>
                    <button
                      type="submit"
                      title="Sign out"
                      aria-label="Sign out"
                      className="rounded-full p-2 text-text-muted transition-colors hover:bg-bg-hover hover:text-text"
                    >
                      <SignOutIcon />
                    </button>
                  </form>
                </div>
                <Link
                  href="/notifications"
                  title="Notifications"
                  aria-label={notificationCount ? `Notifications (${notificationCount})` : "Notifications"}
                  aria-current={pathname.startsWith("/notifications") ? "page" : undefined}
                  className={`relative -mr-1 rounded-full p-2 transition-colors hover:bg-bg-hover sm:ml-1 ${
                    pathname.startsWith("/notifications") ? "text-accent" : "text-text-muted hover:text-text"
                  }`}
                >
                  <BellIcon />
                  {notificationCount > 0 && (
                    <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-urgent px-1 tabular-nums text-[10px] font-semibold leading-none text-bg-raised">
                      {notificationCount > 99 ? "99+" : notificationCount}
                    </span>
                  )}
                </Link>
              </div>
            </div>
            <div className="nav-glow" aria-hidden />
            <div className="nav-glow-line" aria-hidden />
          </header>
          <main className="pb-tabbar mx-auto max-w-4xl px-4 pt-5 sm:px-6 sm:py-6">{children}</main>
          <MobileNav people={people} showTeam={showTeam} />
          <SearchPalette />
        </div>
      </UndoProvider>
    </DirectoryProvider>
  );
}
