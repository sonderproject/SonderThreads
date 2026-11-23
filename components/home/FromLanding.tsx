"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { executeCommand } from "@/lib/actions/command";
import { clearTried, loadTried } from "@/lib/try-it";

/**
 * After sign-up: the sentences someone tried on the landing page ("Try it now"),
 * kept in their browser, offered once on the dashboard. Nothing is added until they say so.
 */
export function FromLanding() {
  const router = useRouter();
  const [sentences, setSentences] = useState<string[]>([]);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => setSentences(loadTried()), []);

  if (done) {
    return (
      <div className="card flex items-center justify-between gap-3 p-4 text-sm" role="status">
        <span className="text-accent">{done}</span>
        <button type="button" onClick={() => setDone(null)} className="text-xs text-text-muted hover:text-text">
          Close
        </button>
      </div>
    );
  }
  if (!sentences.length) return null;

  const add = () =>
    start(async () => {
      const result = await executeCommand(sentences.join("\n"), new Date().getTimezoneOffset());
      clearTried();
      setSentences([]);
      setDone(result.kind === "error" ? result.message : `✓ Added ${sentences.length === 1 ? "it" : `all ${sentences.length}`} to Surfdesk`);
      router.refresh();
    });

  return (
    <section className="card space-y-3 p-5" aria-label="From before you signed up">
      <div className="space-y-1">
        <p className="section-label">Before you signed up</p>
        <p className="text-sm text-text-muted">You tried {sentences.length === 1 ? "this" : "these"} on our site. Add {sentences.length === 1 ? "it" : "them"} to your account?</p>
      </div>
      <ul className="space-y-1.5">
        {sentences.map((s) => (
          <li key={s} className="rounded-xl border border-border-subtle px-3 py-2 text-sm">
            <span className="text-accent">&gt;</span> {s}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={add}
          disabled={pending}
          className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-bg hover:bg-accent-dim disabled:opacity-60"
        >
          {pending ? "Adding…" : sentences.length === 1 ? "Add it" : "Add them"}
        </button>
        <button
          type="button"
          onClick={() => {
            clearTried();
            setSentences([]);
          }}
          className="rounded-full border border-border px-5 py-2 text-sm text-text-muted hover:text-text"
        >
          No thanks
        </button>
      </div>
    </section>
  );
}
