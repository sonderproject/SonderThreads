"use client";

import { useEffect, useState } from "react";
import { removePushSubscription, savePushSubscription } from "@/lib/actions/notifications";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type State = "loading" | "unsupported" | "off" | "on" | "blocked";

/** Turns push notifications on or off for this device. */
export function PushToggle({ publicKey }: { publicKey: string }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("blocked");
      return;
    }
    navigator.serviceWorker
      .getRegistration("/")
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("off"));
  }, []);

  async function turnOn() {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        }));
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await savePushSubscription({ ...json, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      setState("on");
    } catch (err) {
      console.error(err);
      setError("Couldn't turn on push notifications on this device.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") return <p className="text-xs text-text-faint">Checking…</p>;
  if (state === "unsupported") {
    return (
      <p className="text-xs text-text-muted">
        This browser can&apos;t get push notifications. On iPhone, add sonderthreads to your Home Screen first
        (Share → Add to Home Screen), then open it from there.
      </p>
    );
  }
  if (state === "blocked") {
    return (
      <p className="text-xs text-text-muted">
        Notifications are blocked for this site. Allow them in your browser or phone settings, then reload.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {error && <p className="text-xs text-danger">{error}</p>}
      <button
        type="button"
        disabled={busy}
        onClick={state === "on" ? turnOff : turnOn}
        className="rounded border border-border px-3 py-1.5 text-sm font-medium text-text hover:bg-bg-hover disabled:opacity-50"
      >
        {state === "on" ? "Turn off on this device" : "Turn on for this device"}
      </button>
      {state === "on" && <p className="text-xs text-text-muted">Push notifications are on for this device.</p>}
    </div>
  );
}
