"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/nav/ThemeToggle";
import { logout } from "@/app/login/actions";
import { MobileNav } from "@/components/nav/MobileNav";
import type { Person } from "@/lib/types";

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
}: {
  children: React.ReactNode;
  people?: Pick<Person, "id" | "display_name">[];
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-bg">
      <header className="pt-safe sticky top-0 z-20 border-b border-border bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="font-mono text-lg text-accent">
            &gt; sonderthreads
          </Link>
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
            <a
              href="/api/export"
              title="Download a full backup of your data (JSON)"
              className="rounded px-2 py-1.5 text-sm text-text-muted transition-colors hover:bg-bg-hover hover:text-text"
            >
              ⭳
            </a>
            <ThemeToggle />
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
        </div>
      </header>
      <main className="pb-tabbar mx-auto max-w-4xl px-4 pt-5 sm:px-6 sm:py-6">{children}</main>
      <MobileNav people={people} />
    </div>
  );
}
