"use client";

import { useEffect, useRef } from "react";

/**
 * What the phone's floating + button does on the current page. A page that can add
 * something (a task, a person, a calendar item…) registers its own "new" action here;
 * on pages without one, + opens the command bar.
 */
let current: (() => void) | null = null;

export function usePageAdd(action: () => void): void {
  const ref = useRef(action);
  ref.current = action;
  useEffect(() => {
    const run = () => ref.current();
    current = run;
    return () => {
      if (current === run) current = null;
    };
  }, []);
}

/** Runs the page's own "new" action; false if the page has none. */
export function runPageAdd(): boolean {
  if (!current) return false;
  current();
  return true;
}
