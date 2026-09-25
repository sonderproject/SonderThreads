"use client";

import { cloneElement, isValidElement, useRef, useState, type ReactElement } from "react";
import { useVoiceInput } from "@/components/voice/useVoiceInput";
import { MicIcon } from "@/components/ui/icons";

/** Adds spoken text after whatever is already typed. */
function join(base: string, spoken: string): string {
  const b = base.replace(/\s+$/, "");
  return b ? `${b} ${spoken}` : spoken;
}

/**
 * Wraps a text <input> or <textarea> with a mic button. Speech fills the
 * field live and is appended to any existing text. The button doesn't take
 * focus, so fields that save on blur (inline edits) stay open while you talk.
 *
 *   <Dictate value={title} onChange={setTitle}>
 *     <input value={title} onChange={…} className="input" />
 *   </Dictate>
 */
export function Dictate({
  value,
  onChange,
  children,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactElement<{ className?: string }>;
  className?: string;
}) {
  const base = useRef(value);
  const [error, setError] = useState<string | null>(null);
  const voice = useVoiceInput({
    onPartial: (text) => onChange(join(base.current, text)),
    onFinal: (text) => onChange(join(base.current, text)),
    onError: setError,
  });
  const listening = voice.state === "listening";
  const busy = voice.state === "transcribing";
  const isTextarea = isValidElement(children) && children.type === "textarea";

  const field = isValidElement(children)
    ? cloneElement(children, { className: `${children.props.className ?? ""} pr-11` })
    : children;

  return (
    <div className={`relative w-full min-w-0 flex-1 ${className}`}>
      {field}
      <button
        type="button"
        tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          setError(null);
          if (listening) return voice.stop();
          base.current = value;
          voice.start();
        }}
        disabled={busy}
        aria-label={listening ? "Stop dictation" : "Dictate"}
        aria-pressed={listening}
        className={`absolute right-1 flex h-8 w-8 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
          isTextarea ? "bottom-1.5" : "top-1/2 -translate-y-1/2"
        } ${listening ? "animate-pulse bg-accent text-bg" : "text-text-faint hover:text-accent"}`}
      >
        <MicIcon className="h-4 w-4" />
      </button>
      {error && <p className="mt-1 font-mono text-xs text-warn">{error}</p>}
    </div>
  );
}
