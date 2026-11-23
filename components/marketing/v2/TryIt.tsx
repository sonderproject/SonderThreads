"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { track } from "@vercel/analytics";
import { saveTried, tryCommand, type TryResult } from "@/lib/try-it";

const EXAMPLES = [
  "Remind me to call Sarah Friday",
  "Add milk and eggs to my shopping list",
  "Ana – haircut $45",
  "Marcus got the job at Amazon",
  "Follow up with Jessica next Tuesday at 3pm",
  "Jasmine – housing help",
];

/**
 * "Try it now": a working Surfdesk command box on the landing page. Runs the app's own
 * built-in reader in the browser (lib/try-it.ts) on sample people; nothing is sent anywhere.
 * "Save this and start free" keeps the sentences in this browser, and the dashboard offers
 * to add them after sign-up (components/home/FromLanding.tsx).
 */
export function TryIt({ page, signupHref }: { page: string; signupHref: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [runs, setRuns] = useState<{ said: string; results: TryResult[] }[]>([]);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const run = async (value: string) => {
    const said = value.trim();
    if (!said || busy) return;
    setBusy(true);
    const results = await tryCommand(said);
    setRuns((r) => [{ said, results }, ...r].slice(0, 4));
    setText("");
    setBusy(false);
    track("Try It", { page, items: results.length });
    input.current?.focus();
  };

  const save = () => {
    saveTried(runs.map((r) => r.said).reverse());
    track("Try It Save", { page, items: runs.length });
    router.push(signupHref);
  };

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(text);
        }}
        className="flex items-center gap-2 rounded-2xl border py-2 pl-4 pr-2 transition-colors focus-within:border-[var(--band-accent)]"
        style={{ background: "var(--band-raised)", borderColor: "var(--band-line)" }}
      >
        <span className="tabular-nums" style={{ color: "var(--band-accent)" }} aria-hidden>
          &gt;
        </span>
        <label htmlFor="try-it" className="sr-only">
          Type anything for Surfdesk
        </label>
        <input
          ref={input}
          id="try-it"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a reminder, a note, anything…"
          autoComplete="off"
          enterKeyHint="go"
          maxLength={300}
          className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none placeholder:opacity-60 focus-visible:outline-none"
          style={{ color: "var(--band-fg)" }}
        />
        <button
          type="submit"
          disabled={!text.trim() || busy}
          className="rounded-full px-4 py-2 text-sm font-semibold transition-opacity disabled:opacity-40"
          style={{ background: "var(--band-accent)", color: "var(--band-bg)" }}
        >
          Enter
        </button>
      </form>

      <div className="flex flex-wrap gap-2" aria-label="Examples">
        {EXAMPLES.map((ex, i) => (
          <button
            key={ex}
            type="button"
            onClick={() => void run(ex)}
            className={`min-h-9 rounded-full border px-3.5 py-2 text-sm transition-colors hover:border-[var(--band-accent)] ${i > 3 ? "hidden sm:inline-block" : ""}`}
            style={{ borderColor: "var(--band-line)", color: "var(--band-muted)" }}
          >
            {ex}
          </button>
        ))}
      </div>

      <div aria-live="polite" className="space-y-3">
        {runs.map((r, i) => (
          <div
            key={`${r.said}-${runs.length - i}`}
            className={`space-y-2 rounded-2xl border p-4 ${i === 0 ? "motion-safe:animate-[step-in_300ms_ease-out]" : "opacity-70"}`}
            style={{ background: "var(--band-raised)", borderColor: i === 0 ? "var(--band-accent)" : "var(--band-line)" }}
          >
            <p className="truncate text-xs" style={{ color: "var(--band-muted)" }}>
              “{r.said}”
            </p>
            {r.results.map((res, j) => (
              <div key={j} className="flex gap-3">
                <span
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm"
                  style={{ background: "var(--band-accent)", color: "var(--band-bg)" }}
                  aria-hidden
                >
                  ✓
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold">{res.title}</p>
                  {res.details.length > 0 && (
                    <p className="text-sm" style={{ color: "var(--band-muted)" }}>
                      {res.details.join(" · ")}
                    </p>
                  )}
                  {res.offer && (
                    <p className="text-xs" style={{ color: "var(--band-accent)" }}>
                      {res.offer}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {runs.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={save}
            className="rounded-full px-6 py-3 text-sm font-semibold"
            style={{ background: "var(--band-fg)", color: "var(--band-bg)" }}
          >
            Save {runs.length > 1 ? "these" : "this"} and start free →
          </button>
          <p className="text-xs" style={{ color: "var(--band-muted)" }}>
            {runs.length > 1 ? "They'll" : "It'll"} be waiting in your account. 7 days free, no card.
          </p>
        </div>
      )}

      <p className="text-[11px]" style={{ color: "var(--band-muted)" }}>
        This preview runs right in your browser with sample people (Ana, Marcus, Sarah, Jessica…). Nothing you type is sent anywhere. In the app,
        AI handles even messier sentences.
      </p>
    </div>
  );
}
