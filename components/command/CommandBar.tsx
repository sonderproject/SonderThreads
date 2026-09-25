"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { executeCommand, previewCommand, type CommandPreview, type CommandResult } from "@/lib/actions/command";
import { SearchResultsPanel } from "@/components/search/SearchResultsPanel";
import { useVoiceInput } from "@/components/voice/useVoiceInput";
import { MicIcon, SendIcon } from "@/components/ui/icons";
import { useDirectory, VOICE_STOP_EVENT } from "@/components/command/Directory";
import { applyFollowUp, detectBareCommand, followUpPrompt, isDoneWord, type FollowUp } from "@/lib/ai/followup";
import { formatDue } from "@/lib/format-due";

const tzOffset = () => new Date().getTimezoneOffset();

/** The @name / #list token being typed right before the cursor, if any. */
function activeToken(text: string, cursor: number): { sigil: "@" | "#"; query: string; start: number } | null {
  const m = text.slice(0, cursor).match(/(^|\s)([@#])([^\s@#]{0,30})$/);
  if (!m) return null;
  return { sigil: m[2] as "@" | "#", query: m[3].toLowerCase(), start: cursor - m[3].length - 1 };
}

export function CommandBar({
  autoFocus = false,
  autoVoice = false,
  holdToTalk = false,
  initialValue = "",
  initialFollowUp = null,
}: {
  autoFocus?: boolean;
  /** Start listening as soon as the bar mounts (the mic shortcut, hold-to-talk). */
  autoVoice?: boolean;
  /** Keep listening until a VOICE_STOP_EVENT (finger lifted) instead of stopping on a pause. */
  holdToTalk?: boolean;
  initialValue?: string;
  initialFollowUp?: FollowUp | null;
}) {
  const [value, setValue] = useState(initialValue);
  const [cursor, setCursor] = useState(initialValue.length);
  const [result, setResult] = useState<CommandResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<CommandPreview[] | null>(null);
  const [followUp, setFollowUp] = useState<FollowUp | null>(initialFollowUp);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const previewSeq = useRef(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastWasVoice = useRef(false);
  const router = useRouter();
  const { people, lists } = useDirectory();

  const voice = useVoiceInput({
    onPartial: (text) => {
      setVoiceError(null);
      setValue(text);
    },
    onFinal: (text) => {
      lastWasVoice.current = true;
      setValue(text);
      setCursor(text.length);
      // Nothing gets saved by these, so they can advance hands-free.
      if (followUp && isDoneWord(text)) {
        setFollowUp(null);
        setValue("");
      } else if (!followUp && detectBareCommand(text)) {
        beginFollowUp(detectBareCommand(text)!, true);
      }
    },
    onError: setVoiceError,
  });

  const listen = useCallback(() => {
    setVoiceError(null);
    voice.start({ hold: holdToTalk });
  }, [voice, holdToTalk]);

  // Mic shortcut / hold-to-talk: start listening on mount; finger lift stops it.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoVoice || autoStarted.current || voice.mode === "none") return;
    autoStarted.current = true;
    listen();
  }, [autoVoice, voice.mode, listen]);

  useEffect(() => {
    const stop = () => voice.stop();
    window.addEventListener(VOICE_STOP_EVENT, stop);
    return () => window.removeEventListener(VOICE_STOP_EVENT, stop);
  }, [voice]);

  // Auto-grow the textarea for brain dumps.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  // Live "here's what this will do" preview, debounced.
  useEffect(() => {
    const input = value.trim();
    const seq = ++previewSeq.current;
    const command = followUp ? applyFollowUp(followUp, input) : input;
    if (!command || input.length < 2 || (!followUp && detectBareCommand(input))) {
      setPreview(null);
      return;
    }
    const id = setTimeout(async () => {
      try {
        const next = await previewCommand(command, tzOffset());
        if (seq === previewSeq.current) setPreview(next);
      } catch {
        // A preview is a nicety; never surface its errors.
      }
    }, 200);
    return () => clearTimeout(id);
  }, [value, followUp]);

  const token = activeToken(value, cursor);
  const suggestions = useMemo(() => {
    if (!token) return [];
    const pool = token.sigil === "@" ? people.map((p) => p.display_name) : lists.map((l) => l.name);
    const q = token.query;
    return pool
      .filter((name) => !q || name.toLowerCase().split(/\s+/).some((w) => w.startsWith(q)) || name.toLowerCase().startsWith(q))
      .slice(0, 6);
  }, [token, people, lists]);

  function pick(name: string) {
    if (!token) return;
    const next = `${value.slice(0, token.start)}${name} ${value.slice(cursor)}`;
    const pos = token.start + name.length + 1;
    setValue(next);
    setCursor(pos);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(pos, pos);
    });
  }

  function beginFollowUp(f: FollowUp, viaVoice: boolean) {
    setFollowUp(f);
    setValue("");
    setPreview(null);
    setResult(null);
    if (viaVoice && voice.mode !== "none") setTimeout(() => voice.start({ hold: false }), 350);
    else requestAnimationFrame(() => inputRef.current?.focus());
  }

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const input = value.trim().replace(/(^|\s)[@#](?=\S)/g, "$1");
    const viaVoice = lastWasVoice.current;
    lastWasVoice.current = false;
    if (!input || pending) return;

    let command = input;
    const current = followUp;
    if (current) {
      const built = applyFollowUp(current, input);
      if (!built) {
        setFollowUp(null);
        setValue("");
        return;
      }
      command = built;
    } else {
      const bare = detectBareCommand(input);
      if (bare) {
        beginFollowUp(bare, viaVoice);
        return;
      }
    }

    setValue("");
    setCursor(0);
    setPreview(null);
    setResult(null);

    startTransition(async () => {
      const res = await executeCommand(command, tzOffset());
      setResult(res);
      router.refresh();

      // A new list/group → offer to fill it; list items → keep going until "done".
      if (current?.kind === "list" || current?.kind === "group") {
        if (res.kind === "confirmation" && res.listName) beginFollowUp({ kind: "list-items", listName: res.listName }, viaVoice);
        else setFollowUp(null);
      } else if (current?.kind === "list-items") {
        if (viaVoice && voice.mode !== "none") setTimeout(() => voice.start({ hold: false }), 350);
      } else {
        setFollowUp(null);
      }

      if (res.kind === "confirmation" || res.kind === "batch") {
        setTimeout(() => setResult((cur) => (cur === res ? null : cur)), 6000);
      }
    });
  }

  const listening = voice.state === "listening";
  const transcribing = voice.state === "transcribing";
  const placeholder = listening
    ? "Listening…"
    : transcribing
      ? "Transcribing…"
      : followUp
        ? followUpPrompt(followUp)
        : "Type or say a task, note, reminder…";

  return (
    <div>
      {followUp && (
        <div className="mb-2 flex items-center justify-between font-mono text-sm">
          <span className="text-accent">? {followUpPrompt(followUp)}</span>
          <button
            type="button"
            onClick={() => {
              setFollowUp(null);
              setValue("");
              voice.stop();
            }}
            className="h-8 px-2 text-text-faint hover:text-text"
          >
            {followUp.kind === "list-items" ? "done" : "cancel"}
          </button>
        </div>
      )}

      <form
        onSubmit={submit}
        className={`flex items-end gap-2 rounded border bg-bg-raised py-2 pl-4 pr-2 transition-colors focus-within:border-accent ${
          listening ? "border-accent" : "border-border"
        }`}
      >
        <span className="pb-2 font-mono text-accent">&gt;</span>
        <textarea
          ref={inputRef}
          rows={1}
          value={value}
          autoFocus={autoFocus && !autoVoice}
          enterKeyHint="send"
          onChange={(e) => {
            lastWasVoice.current = false;
            setValue(e.target.value);
            setCursor(e.target.selectionStart ?? e.target.value.length);
          }}
          onSelect={(e) => setCursor(e.currentTarget.selectionStart ?? 0)}
          onKeyDown={(e) => {
            if (e.key === "Tab" && suggestions.length) {
              e.preventDefault();
              pick(suggestions[0]);
            } else if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            } else if (e.key === "Escape" && followUp) {
              setFollowUp(null);
            }
          }}
          placeholder={placeholder}
          aria-label="Command"
          className="max-h-40 min-h-[2.25rem] flex-1 resize-none bg-transparent py-1.5 font-mono text-base text-text outline-none placeholder:text-text-faint sm:text-sm"
          disabled={pending}
        />
        <button
          type="button"
          onClick={() => (listening ? voice.stop() : listen())}
          disabled={transcribing || pending}
          aria-label={listening ? "Stop listening" : "Speak a command"}
          aria-pressed={listening}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
            listening ? "animate-pulse bg-accent text-bg" : "text-text-muted hover:bg-bg-hover hover:text-accent"
          }`}
        >
          <MicIcon />
        </button>
        {value.trim() && (
          <button
            type="submit"
            disabled={pending}
            aria-label="Send"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-bg disabled:opacity-50"
          >
            <SendIcon />
          </button>
        )}
      </form>

      {suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2" role="listbox" aria-label="Suggestions">
          {suggestions.map((name) => (
            <button
              key={name}
              type="button"
              role="option"
              aria-selected={false}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(name)}
              className="h-9 rounded border border-border px-3 font-mono text-sm text-text hover:border-accent"
            >
              {token?.sigil}
              {name}
            </button>
          ))}
        </div>
      )}

      {voiceError && <p className="mt-2 font-mono text-xs text-warn">{voiceError}</p>}

      {preview && value.trim() && !pending && (
        <div className="mt-2 font-mono text-sm text-text-muted" aria-live="polite">
          {preview.length > 1 && <p className="text-accent">→ {preview.length} items</p>}
          {preview.map((p, i) => (
            <p key={i} className={`truncate ${preview.length > 1 ? "pl-3" : ""}`}>
              <span className="text-accent">{preview.length > 1 ? "· " : "→ "}{p.action}</span>
              {[...p.details, ...(p.dueDate ? [formatDue(p.dueDate)] : [])].map((d, j) => (
                <span key={j}> · {d}</span>
              ))}
            </p>
          ))}
        </div>
      )}

      {pending && <p className="mt-2 font-mono text-xs text-text-faint">Working...</p>}

      {result && <ResultView result={result} onClose={() => setResult(null)} />}
    </div>
  );
}

function ResultView({ result, onClose }: { result: CommandResult; onClose: () => void }) {
  if (result.kind === "batch") {
    return (
      <div className="mt-2 space-y-0.5">
        {result.results.map((r, i) => (
          <ResultView key={i} result={r} onClose={onClose} />
        ))}
      </div>
    );
  }
  if (result.kind === "confirmation") {
    return (
      <p className="mt-2 font-mono text-xs text-accent">
        {result.href ? (
          <Link href={result.href} className="hover:underline">
            {result.message}
          </Link>
        ) : (
          result.message
        )}
      </p>
    );
  }
  if (result.kind === "error") return <p className="mt-2 font-mono text-xs text-danger">{result.message}</p>;
  return <SearchResultsPanel query={result.query} results={result.results} onClose={onClose} />;
}
