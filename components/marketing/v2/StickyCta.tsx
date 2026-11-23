"use client";

import { useEffect, useState } from "react";
import { TrackedLink } from "@/components/marketing/landing/Track";

/** Phones only: a "Get Started Free" bar that appears once the hero has scrolled away. */
export function StickyCta({ page, href }: { page: string; href: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const nearEnd = window.innerHeight + window.scrollY > document.documentElement.scrollHeight - 700;
      setShow(window.scrollY > 650 && !nearEnd);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div
      className={`glass pb-safe-5 fixed inset-x-0 bottom-0 z-30 border-t px-4 pt-3 transition-transform duration-300 sm:hidden ${show ? "translate-y-0" : "translate-y-full"}`}
      aria-hidden={!show}
    >
      <div className="flex items-center gap-3">
        <TrackedLink page={page} cta="sticky_mobile" href={href} className="flex-1 rounded-full bg-accent px-5 py-3 text-center text-sm font-semibold text-bg">
          Get Started Free
        </TrackedLink>
        <span className="text-xs leading-tight text-text-muted">
          7 days free
          <br />
          No card
        </span>
      </div>
    </div>
  );
}
