"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { isActive, type NavItem } from "@/lib/nav";

const count = (n: number) => (n > 99 ? "99+" : String(n));

/** The top bar's "More" / "Workspace" menu: a button that opens a short list of links. */
export function NavMenu({ label, items, badge }: { label: string; items: NavItem[]; badge: number }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const box = useRef<HTMLDivElement>(null);
  const active = items.some((i) => isActive(pathname, i));

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  if (!items.length) return null;
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-colors ${
          active ? "bg-accent-soft font-medium text-accent" : "text-text-muted hover:bg-bg-hover hover:text-text"
        }`}
      >
        {label}
        {badge > 0 && (
          <span className="ml-0.5 rounded-full bg-urgent px-1.5 text-[10px] font-semibold leading-4 text-bg-raised" aria-label={`${badge} new`}>
            {count(badge)}
          </span>
        )}
        <span aria-hidden className="text-xs">
          ▾
        </span>
      </button>
      {open && (
        <div className="card absolute right-0 z-30 mt-2 w-56 overflow-hidden p-1 shadow-lg">
          {items.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              aria-current={isActive(pathname, i) ? "page" : undefined}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${isActive(pathname, i) ? "bg-accent-soft text-accent" : "text-text hover:bg-bg-hover"}`}
            >
              {i.label}
              {i.badge ? <span className="tag tag-u">{count(i.badge)}</span> : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
