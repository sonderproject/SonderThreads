"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const AWAY_MS = 60_000;

/**
 * When you come back to the tab (or the phone wakes, or the network returns)
 * after a minute or more, quietly refresh the current page. That wakes the
 * server and its database connection before your first tap, and shows
 * anything that changed while you were away. What you're typing is kept.
 */
export function WakeOnReturn() {
  const router = useRouter();
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    const wake = () => router.refresh();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
      } else if (hiddenAt.current !== null && Date.now() - hiddenAt.current >= AWAY_MS) {
        hiddenAt.current = null;
        wake();
      }
    };
    // Restored from the back/forward cache (common on phones).
    const onPageShow = (e: PageTransitionEvent) => e.persisted && wake();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", wake);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", wake);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [router]);

  return null;
}
