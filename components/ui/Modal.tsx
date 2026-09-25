"use client";

import { ReactNode, useEffect } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * Dialog on desktop, bottom sheet on phones: it slides up from the bottom
 * edge so its buttons sit within thumb reach, and pads past the iPhone
 * home indicator.
 */
export function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-start sm:px-4 sm:pt-32"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="sheet-in max-h-[88dvh] w-full overflow-y-auto rounded-t-2xl border border-border bg-bg-raised p-5 pb-safe-5 shadow-xl sm:max-w-md sm:rounded sm:pb-5"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mx-auto -mt-2 mb-3 h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-mono text-sm uppercase tracking-wide text-text">{title}</h2>
          <button
            onClick={onClose}
            className="-mr-2 flex h-10 w-10 items-center justify-center rounded text-text-muted hover:bg-bg-hover hover:text-text"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
