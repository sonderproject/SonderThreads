"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type UndoEntry = { id: number; message: string; undo: () => Promise<void> | void };
type UndoApi = { show: (message: string, undo: UndoEntry["undo"]) => void };

const UndoContext = createContext<UndoApi>({ show: () => {} });

/** Show a short-lived "Undo" bar after a completing, deleting or moving action. */
export function useUndo(): UndoApi {
  return useContext(UndoContext);
}

const DURATION_MS = 5000;

export function UndoProvider({ children }: { children: React.ReactNode }) {
  const [entry, setEntry] = useState<UndoEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  const show = useCallback<UndoApi["show"]>((message, undo) => {
    setEntry({ id: ++seq.current, message, undo });
  }, []);

  useEffect(() => {
    if (!entry) return;
    const id = setTimeout(() => setEntry((cur) => (cur?.id === entry.id ? null : cur)), DURATION_MS);
    return () => clearTimeout(id);
  }, [entry]);

  async function runUndo() {
    if (!entry || busy) return;
    setBusy(true);
    try {
      await entry.undo();
    } finally {
      setBusy(false);
      setEntry(null);
    }
  }

  return (
    <UndoContext.Provider value={{ show }}>
      {children}
      {entry && (
        <div
          role="status"
          className="bottom-above-tabbar sheet-in fixed left-4 right-20 z-40 flex items-center justify-between gap-3 rounded border border-border bg-bg-raised px-4 py-3 shadow-lg shadow-black/40 sm:bottom-6 sm:left-1/2 sm:right-auto sm:w-96 sm:-translate-x-1/2"
        >
          <span className="truncate font-mono text-sm text-text">{entry.message}</span>
          <button
            onClick={runUndo}
            disabled={busy}
            className="h-9 shrink-0 rounded px-3 font-mono text-sm uppercase text-accent hover:bg-bg-hover disabled:opacity-50"
          >
            {busy ? "…" : "Undo"}
          </button>
        </div>
      )}
    </UndoContext.Provider>
  );
}
