"use client";

import { useState, useTransition } from "react";
import { newInviteLink } from "@/lib/actions/org";

/** Pending invite row: make a fresh link and copy it, to send by text or chat. */
export function CopyInviteLink({ inviteId }: { inviteId: string }) {
  const [state, setState] = useState<"idle" | "copied" | "shown">("idle");
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function go() {
    setError(null);
    startTransition(async () => {
      const result = await newInviteLink(inviteId);
      if (!result.ok) return setError(result.error);
      const full = `${window.location.origin}${result.data.link}`;
      setLink(full);
      try {
        await navigator.clipboard.writeText(full);
        setState("copied");
      } catch {
        setState("shown");
      }
    });
  }

  return (
    <div className="space-y-1 text-right">
      <button type="button" onClick={go} disabled={pending} className="text-xs font-medium text-accent hover:underline">
        {pending ? "Making link…" : state === "copied" ? "Link copied ✓" : "Copy invite link"}
      </button>
      {link && state === "shown" && <code className="block max-w-56 select-all break-all text-[10px] text-text">{link}</code>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
