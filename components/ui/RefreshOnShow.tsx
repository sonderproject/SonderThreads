"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-fetches the page's data when it's shown. Back/forward navigation (and the
 * client cache) can replay a copy of the page from before an edit, which made
 * saved values look lost until a full reload.
 */
export function RefreshOnShow() {
  const router = useRouter();
  useEffect(() => {
    router.refresh();
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) router.refresh();
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, [router]);
  return null;
}
