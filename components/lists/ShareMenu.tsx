"use client";

import { useEffect, useRef, useState } from "react";
import type { List, ListItem } from "@/lib/types";

/** The list as plain text that reads well in an email or a text message. */
function listAsText(list: List, items: ListItem[]): string {
  const lines = [list.name];
  if (list.description) lines.push(list.description);
  lines.push("");
  for (const item of items) lines.push(`${item.checked ? "✓" : "•"} ${item.label}`);
  if (items.length === 0) lines.push("(empty)");
  return lines.join("\n");
}

function closeMenu(el: HTMLElement) {
  el.closest("details")?.removeAttribute("open");
}

export function ShareMenu({ list, items }: { list: List; items: ListItem[] }) {
  const [canShare, setCanShare] = useState(false);
  const [canShareFiles, setCanShareFiles] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const pdf = useRef<Promise<File> | null>(null);

  // Native share sheet exists on phones and some desktop browsers; detect after mount.
  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
    try {
      const probe = new File([""], "probe.pdf", { type: "application/pdf" });
      setCanShareFiles(typeof navigator.canShare === "function" && navigator.canShare({ files: [probe] }));
    } catch {
      setCanShareFiles(false);
    }
  }, []);

  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(null), 2000);
    return () => clearTimeout(t);
  }, [status]);

  const text = listAsText(list, items);
  const subject = list.name;
  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  // "sms:?&body=" is the form both iOS and Android Messages accept.
  const sms = `sms:?&body=${encodeURIComponent(text)}`;

  async function shareText(e: React.MouseEvent<HTMLButtonElement>) {
    closeMenu(e.currentTarget);
    try {
      await navigator.share({ title: subject, text });
    } catch {
      // Cancelled by the user — nothing to do.
    }
  }

  async function fetchPdf(): Promise<File> {
    const res = await fetch(`/api/lists/${list.id}/export?format=pdf`);
    if (!res.ok) throw new Error(String(res.status));
    const name = res.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? `${list.name}.pdf`;
    return new File([await res.blob()], name, { type: "application/pdf" });
  }

  // Safari only opens the share sheet right after a tap, so the PDF is
  // fetched as soon as the menu opens rather than after "Share as PDF" is tapped.
  function onToggle(e: React.SyntheticEvent<HTMLDetailsElement>) {
    if (e.currentTarget.open && canShareFiles) {
      pdf.current = fetchPdf();
      pdf.current.catch(() => (pdf.current = null));
    }
  }

  async function sharePdf(e: React.MouseEvent<HTMLButtonElement>) {
    closeMenu(e.currentTarget);
    try {
      const file = await (pdf.current ?? fetchPdf());
      await navigator.share({ title: subject, files: [file] });
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") setStatus("Couldn't share the PDF");
    }
  }

  async function copy(e: React.MouseEvent<HTMLButtonElement>) {
    closeMenu(e.currentTarget);
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Copied");
    } catch {
      setStatus("Couldn't copy");
    }
  }

  const itemClass = "block w-full px-3 py-2 text-left text-sm text-text hover:bg-bg-hover";

  return (
    <details className="relative" onToggle={onToggle}>
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded border border-border px-3 py-1.5 text-sm font-medium text-text transition-colors hover:bg-bg-hover [&::-webkit-details-marker]:hidden">
        {status ?? "Share ▾"}
      </summary>
      <div className="absolute left-0 z-20 mt-1 w-44 overflow-hidden sm:left-auto sm:right-0 rounded border border-border bg-bg shadow-lg">
        {canShare && (
          <button type="button" onClick={shareText} className={itemClass}>
            Share…
          </button>
        )}
        {canShareFiles && (
          <button type="button" onClick={sharePdf} className={itemClass}>
            Share as PDF…
          </button>
        )}
        <a href={mailto} onClick={(e) => closeMenu(e.currentTarget)} className={itemClass}>
          Email
        </a>
        <a href={sms} onClick={(e) => closeMenu(e.currentTarget)} className={itemClass}>
          Text message
        </a>
        <button type="button" onClick={copy} className={itemClass}>
          Copy as text
        </button>
      </div>
    </details>
  );
}
