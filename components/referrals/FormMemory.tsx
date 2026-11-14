"use client";

import { useEffect } from "react";

/**
 * Keeps what someone typed into a public form if the page comes back with an
 * error (e.g. their appointment time was just taken), so they don't retype it.
 * Saved only in this browser tab (sessionStorage) and cleared after a
 * successful send. Put it inside the <form>.
 */
export function FormMemory({ storageKey, restore, clear }: { storageKey: string; restore: boolean; clear: boolean }) {
  useEffect(() => {
    const form = document.querySelector<HTMLFormElement>(`form[data-memory="${storageKey}"]`);
    try {
      if (clear) sessionStorage.removeItem(storageKey);
      if (!form) return;
      if (restore) {
        const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "{}") as Record<string, string>;
        // Two passes: choosing "Other" for the service shows the box its typed value goes in.
        const fill = () => {
          for (const [name, value] of Object.entries(saved)) {
            const el = form.elements.namedItem(name);
            if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) continue;
            if (el.type === "hidden" || el.name === "slot" || el.value === value) continue; // times may have changed: pick again
            // Through the element's own setter, so React-controlled fields notice the change.
            const proto = Object.getPrototypeOf(el) as object;
            Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
            el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
          }
        };
        fill();
        setTimeout(fill, 50);
      }
    } catch {
      // storage blocked: the form just starts empty
    }
    if (!form) return;
    const save = () => {
      const data: Record<string, string> = {};
      for (const el of Array.from(form.elements)) {
        if ((el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) && el.name && el.type !== "hidden" && el.name !== "website") {
          data[el.name] = el.value;
        }
      }
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(data));
      } catch {
        // storage blocked: nothing to remember
      }
    };
    form.addEventListener("input", save);
    form.addEventListener("change", save);
    return () => {
      form.removeEventListener("input", save);
      form.removeEventListener("change", save);
    };
  }, [storageKey, restore, clear]);
  return null;
}
