"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { executeCommand, previewCommand, type CommandPreview, type CommandResult } from "@/lib/actions/command";
import { SearchResultsPanel } from "@/components/search/SearchResultsPanel";

export function CommandBar({ autoFocus = false }: { autoFocus?: boolean }) {
  const [value, setValue] = useState("");
  const [result, setResult] = useState<CommandResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<CommandPreview | null>(null);
  const previewSeq = useRef(0);
  const router = useRouter();

  // Live "here's what this will do" line, debounced so it doesn't fire per keystroke.
  useEffect(() => {
    const input = value.trim();
    const seq = ++previewSeq.current;
    if (input.length < 3) {
      setPreview(null);
      return;
    }
    const id = setTimeout(async () => {
      try {
        const next = await previewCommand(input);
        if (seq === previewSeq.current) setPreview(next);
      } catch {
        // A preview is a nicety; never surface its errors.
      }
    }, 200);
    return () => clearTimeout(id);
  }, [value]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const input = value.trim();
    if (!input) return;
    setValue("");
    setPreview(null);
    setResult(null);

    startTransition(async () => {
      const res = await executeCommand(input);
      setResult(res);
      router.refresh();

      if (res.kind === "confirmation") {
        setTimeout(() => {
          setResult((current) => (current === res ? null : current));
        }, 5000);
      }
    });
  }

  return (
    <div>
      <form
        onSubmit={submit}
        className="flex items-center gap-2 rounded border border-border bg-bg-raised px-4 py-3 transition-colors focus-within:border-accent"
      >
        <span className="font-mono text-accent">&gt;</span>
        <input
          value={value}
          autoFocus={autoFocus}
          enterKeyHint="send"
          onChange={(e) => setValue(e.target.value)}
          placeholder="Type a command, note, task, reminder, or person update..."
          className="flex-1 bg-transparent font-mono text-sm text-text placeholder:text-text-faint outline-none"
          disabled={pending}
        />
        <span className="hidden shrink-0 font-mono text-xs text-text-faint sm:inline">Enter ↵</span>
      </form>

      {preview && value.trim() && !pending && (
        <p className="mt-2 truncate font-mono text-sm text-text-muted" aria-live="polite">
          <span className="text-accent">→ {preview.action}</span>
          {[
            ...preview.details,
            ...(preview.dueDate
              ? [
                  new Date(preview.dueDate).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  }),
                ]
              : []),
          ].map((d, i) => (
            <span key={i}> · {d}</span>
          ))}
        </p>
      )}

      {pending && <p className="mt-2 font-mono text-xs text-text-faint">Working...</p>}

      {result?.kind === "confirmation" && (
        <p className="mt-2 font-mono text-xs text-accent">
          {result.href ? (
            <Link href={result.href} className="hover:underline">
              {result.message}
            </Link>
          ) : (
            result.message
          )}
        </p>
      )}

      {result?.kind === "error" && (
        <p className="mt-2 font-mono text-xs text-danger">{result.message}</p>
      )}

      {result?.kind === "search_results" && (
        <SearchResultsPanel
          query={result.query}
          results={result.results}
          onClose={() => setResult(null)}
        />
      )}
    </div>
  );
}
