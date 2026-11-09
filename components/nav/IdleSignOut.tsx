"use client";

import { useEffect } from "react";
import { IDLE_TIMEOUT_MINUTES } from "@/lib/auth";
import { idleSignOut } from "@/app/login/actions";

const STORAGE_KEY = "st_last_activity";
const HEARTBEAT_MS = 5 * 60_000;
const EVENTS = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;

/**
 * Signs out after IDLE_TIMEOUT_MINUTES without any activity (taps, typing,
 * scrolling) in any open tab. Activity is shared between tabs through
 * localStorage. While someone is active it pings the server every few
 * minutes, so the middleware's own idle check (a backstop for closed tabs)
 * never signs out a person who's busy typing a long note.
 */
export function IdleSignOut() {
  useEffect(() => {
    const limit = IDLE_TIMEOUT_MINUTES * 60_000;
    let last = Date.now();
    let lastPing = Date.now();
    let signingOut = false;

    const read = () => {
      try {
        const v = Number(localStorage.getItem(STORAGE_KEY));
        return Number.isFinite(v) && v > 0 ? v : last;
      } catch {
        return last;
      }
    };
    const expired = () => Date.now() - Math.max(last, read()) > limit;
    const signOut = () => {
      if (signingOut) return;
      signingOut = true;
      void idleSignOut();
    };

    const onActivity = () => {
      if (expired()) return signOut(); // came back after the limit: don't count this as activity
      last = Date.now();
      try {
        localStorage.setItem(STORAGE_KEY, String(last));
      } catch {}
      if (last - lastPing > HEARTBEAT_MS) {
        lastPing = last;
        fetch("/api/auth/heartbeat", { method: "POST", cache: "no-store" }).catch(() => {});
      }
    };

    try {
      localStorage.setItem(STORAGE_KEY, String(last));
    } catch {}
    for (const e of EVENTS) window.addEventListener(e, onActivity, { passive: true });
    const timer = setInterval(() => expired() && signOut(), 30_000);
    const onVisible = () => document.visibilityState === "visible" && expired() && signOut();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      for (const e of EVENTS) window.removeEventListener(e, onActivity);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
