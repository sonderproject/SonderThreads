"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Shows that a tap registered, on every page (mounted once in the root layout):
 *  - a thin bar at the top of the screen while a page is opening or a form is sending;
 *  - a spinner on the button that sent a form (and it can't be pressed twice meanwhile).
 * Starts on a link click to another page or a form submit; stops when the new page shows,
 * when the page re-renders after the form, or after 20 seconds at most.
 */
export function LoadingIndicator() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [active, setActive] = useState(false);
  const button = useRef<HTMLElement | null>(null);
  const safety = useRef<ReturnType<typeof setTimeout> | null>(null);
  const observer = useRef<MutationObserver | null>(null);

  const stop = () => {
    setActive(false);
    if (button.current) {
      button.current.removeAttribute("data-loading");
      button.current.removeAttribute("aria-busy");
      button.current = null;
    }
    if (safety.current) clearTimeout(safety.current);
    observer.current?.disconnect();
    observer.current = null;
  };

  const start = () => {
    setActive(true);
    if (safety.current) clearTimeout(safety.current);
    safety.current = setTimeout(stop, 20_000);
  };

  // A new page (or new search) has shown: done.
  useEffect(() => {
    stop();
  }, [pathname, search]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || /^(mailto|tel|sms):/i.test(href)) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Same page (only the #hash changes): nothing loads.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      start();
    };

    // (React calls preventDefault on forms it sends itself, so that can't be used to skip.
    // The security check holds a form back by stopping the event before it gets here.)
    const onSubmit = (e: SubmitEvent) => {
      setTimeout(() => {
        start();
        const btn = (e.submitter as HTMLElement | null) ?? (e.target as HTMLFormElement).querySelector<HTMLElement>("button[type=submit], button:not([type])");
        if (btn) {
          btn.setAttribute("data-loading", "");
          btn.setAttribute("aria-busy", "true");
          button.current = btn;
        }
        // When the page re-renders after the form's action (no navigation), stop shortly after.
        const startedAt = Date.now();
        observer.current?.disconnect();
        observer.current = new MutationObserver(() => {
          if (Date.now() - startedAt < 250) return;
          setTimeout(stop, 150);
          observer.current?.disconnect();
        });
        observer.current.observe(document.body, { childList: true, subtree: true });
      }, 0);
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit);
    };
  }, []);

  return <div aria-hidden className={`loading-bar ${active ? "loading-bar-on" : ""}`} />;
}
