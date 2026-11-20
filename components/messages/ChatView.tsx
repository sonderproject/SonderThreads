"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, Segment } from "@/lib/messages";
import { deleteMessage, editMessage, pollMessages, searchTags, sendMessage, type TagOption } from "@/lib/actions/messages";
import { PROSE_INPUT } from "@/lib/input-props";

const POLL_MS = 5000;

function latest(msgs: ChatMessage[]): string | null {
  return msgs.reduce<string | null>((a, m) => (!a || m.updatedAt > a ? m.updatedAt : a), null);
}

function merge(prev: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  if (!incoming.length) return prev;
  const byId = new Map(prev.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function time(iso: string): string {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function Body({ segments }: { segments: Segment[] }) {
  return (
    <p className="whitespace-pre-wrap break-words text-sm">
      {segments.map((s, i) =>
        s.t === "text" ? (
          <span key={i}>{s.v}</span>
        ) : s.t === "client" && s.id ? (
          <Link key={i} href={`/people/${s.id}`} className="font-medium text-accent hover:underline">
            #{s.name}
          </Link>
        ) : s.t === "client" ? (
          <span key={i} className="italic text-text-muted">
            {s.name}
          </span>
        ) : (
          <span key={i} className="font-medium text-accent">
            @{s.name}
          </span>
        ),
      )}
    </p>
  );
}

/** Turns the "#Name" / "@Name" picked in the composer into tags the server understands. */
export function encodeTags(text: string, picked: TagOption[]): string {
  let out = text;
  for (const p of [...picked].sort((a, b) => b.name.length - a.name.length)) {
    const label = `${p.kind === "client" ? "#" : "@"}${p.name}`;
    out = out.split(label).join(`<${p.kind === "client" ? "#" : "@"}${p.id}>`);
  }
  return out;
}

/** Finds a "#word" or "@word" being typed right before the cursor. */
function activeTrigger(text: string, caret: number): { kind: "client" | "user"; start: number; q: string } | null {
  const before = text.slice(0, caret);
  const m = before.match(/(^|\s)([#@])([^\s#@]{0,40})$/);
  if (!m) return null;
  return { kind: m[2] === "#" ? "client" : "user", start: caret - m[3].length - 1, q: m[3] };
}

export function Composer({
  conversationId,
  onSend,
  placeholder,
  initial = "",
  initialPicked = [],
  submitLabel = "Send",
  onCancel,
}: {
  conversationId: string;
  onSend: (encoded: string) => Promise<string | null>;
  placeholder: string;
  initial?: string;
  initialPicked?: TagOption[];
  submitLabel?: string;
  onCancel?: () => void;
}) {
  const [text, setText] = useState(initial);
  const [picked, setPicked] = useState<TagOption[]>(initialPicked);
  const [options, setOptions] = useState<TagOption[]>([]);
  const [trigger, setTrigger] = useState<ReturnType<typeof activeTrigger>>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!trigger) {
      setOptions([]);
      return;
    }
    const t = setTimeout(async () => setOptions(await searchTags(conversationId, trigger.kind, trigger.q)), 150);
    return () => clearTimeout(t);
  }, [trigger, conversationId]);

  function onChange(v: string) {
    setText(v);
    setTrigger(activeTrigger(v, ref.current?.selectionStart ?? v.length));
  }

  function pick(o: TagOption) {
    if (!trigger) return;
    const caret = ref.current?.selectionStart ?? text.length;
    const label = `${o.kind === "client" ? "#" : "@"}${o.name} `;
    const next = text.slice(0, trigger.start) + label + text.slice(caret);
    setText(next);
    setPicked((p) => (p.some((x) => x.id === o.id) ? p : [...p, o]));
    setTrigger(null);
    requestAnimationFrame(() => {
      const pos = trigger.start + label.length;
      ref.current?.focus();
      ref.current?.setSelectionRange(pos, pos);
    });
  }

  async function submit() {
    if (busy || !text.trim()) return;
    setBusy(true);
    setError(null);
    const err = await onSend(encodeTags(text, picked));
    setBusy(false);
    if (err) setError(err);
    else {
      setText("");
      setPicked([]);
    }
  }

  return (
    <div className="relative space-y-1">
      {options.length > 0 && (
        <ul className="absolute bottom-full left-0 z-10 mb-1 max-h-56 w-full max-w-xs overflow-auto rounded-xl border border-border bg-bg-raised p-1 shadow-lg">
          {options.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(o);
                }}
                className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-bg-hover"
              >
                {o.kind === "client" ? "#" : "@"}
                {o.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={ref}
          {...PROSE_INPUT}
          value={text}
          rows={2}
          maxLength={4000}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !options.length) {
              e.preventDefault();
              submit();
            }
            if (e.key === "Escape") setTrigger(null);
          }}
          className="input min-h-[2.75rem] flex-1 resize-y"
        />
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={submit}
            disabled={busy || !text.trim()}
            className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-bg hover:bg-accent-dim disabled:opacity-50"
          >
            {submitLabel}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="text-xs text-text-muted hover:text-text">
              Cancel
            </button>
          )}
        </div>
      </div>
      <p className="text-[11px] text-text-faint">Type # to tag a client, @ to mention a teammate. Enter sends, Shift+Enter adds a line.</p>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

function ShareCard({ m }: { m: ChatMessage }) {
  const s = m.share;
  if (!s) return null;
  if (s.type === "task") {
    return (
      <div className="mt-1 rounded-lg border border-border px-3 py-2 text-sm">
        <p className="eyebrow text-text-faint">Shared task (a copy)</p>
        <p>{s.title}</p>
        {s.due && <p className="text-xs text-text-muted">Due {new Date(s.due).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>}
      </div>
    );
  }
  return (
    <div className="mt-1 rounded-lg border border-border px-3 py-2 text-sm">
      <p className="eyebrow text-text-faint">
        Shared note
        {s.personId && s.personName ? (
          <>
            {" "}for{" "}
            <Link href={`/people/${s.personId}`} className="normal-case text-accent hover:underline">
              {s.personName}
            </Link>
          </>
        ) : s.orgNote ? (
          " about a client"
        ) : null}
      </p>
      <p className="whitespace-pre-wrap break-words">{s.excerpt}</p>
    </div>
  );
}

export function ChatView({
  conversationId,
  initial,
  canPost,
  canModerate,
  placeholder,
}: {
  conversationId: string;
  initial: ChatMessage[];
  canPost: boolean;
  canModerate: boolean;
  placeholder: string;
}) {
  const [msgs, setMsgs] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const sinceRef = useRef<string | null>(latest(initial));
  const bottom = useRef<HTMLDivElement>(null);
  const count = useRef(initial.length);

  const apply = useCallback((incoming: ChatMessage[]) => {
    if (!incoming.length) return;
    setMsgs((prev) => merge(prev, incoming));
    const l = latest(incoming);
    if (l && (!sinceRef.current || l > sinceRef.current)) sinceRef.current = l;
  }, []);

  const poll = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    const fresh = await pollMessages(conversationId, sinceRef.current).catch(() => null);
    if (fresh) apply(fresh);
  }, [conversationId, apply]);

  useEffect(() => {
    const t = setInterval(poll, POLL_MS);
    const onVis = () => document.visibilityState === "visible" && poll();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [poll]);

  useEffect(() => {
    if (msgs.length !== count.current) {
      count.current = msgs.length;
      bottom.current?.scrollIntoView({ block: "end" });
    }
  }, [msgs.length]);

  useEffect(() => bottom.current?.scrollIntoView({ block: "end" }), []);

  async function send(encoded: string): Promise<string | null> {
    const r = await sendMessage(conversationId, encoded, sinceRef.current);
    if (!r.ok) return r.error;
    apply(r.messages);
    return null;
  }

  async function remove(id: string) {
    if (!confirm("Delete this message?")) return;
    const r = await deleteMessage(id);
    if (!r.ok) alert(r.error);
    else poll();
  }

  return (
    <div className="space-y-3">
      <div className="card max-h-[60vh] min-h-[12rem] space-y-3 overflow-y-auto p-4">
        {msgs.length === 0 && <p className="text-sm text-text-muted">No messages yet. Say hello.</p>}
        {msgs.map((m) => (
          <div key={m.id} className="group space-y-0.5">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold">{m.mine ? "You" : m.authorName}</span>
              <span className="text-[11px] tabular-nums text-text-faint">{time(m.createdAt)}</span>
              {m.edited && !m.deleted && <span className="text-[11px] text-text-faint">(edited)</span>}
              {!m.deleted && editing !== m.id && (m.mine || canModerate) && (
                <span className="ml-auto hidden gap-2 text-[11px] group-hover:flex group-focus-within:flex">
                  {m.mine && (
                    <button onClick={() => setEditing(m.id)} className="text-text-muted hover:text-accent">
                      Edit
                    </button>
                  )}
                  <button onClick={() => remove(m.id)} className="text-text-muted hover:text-danger">
                    Delete
                  </button>
                </span>
              )}
            </div>
            {m.deleted ? (
              <p className="text-sm italic text-text-faint">Message deleted</p>
            ) : editing === m.id ? (
              <Composer
                conversationId={conversationId}
                placeholder="Edit message"
                initial={m.editText}
                initialPicked={m.segments.flatMap((s): TagOption[] =>
                  s.t === "user" ? [{ kind: "user", id: s.id, name: s.name }] : s.t === "client" && s.id ? [{ kind: "client", id: s.id, name: s.name }] : [],
                )}
                submitLabel="Save"
                onCancel={() => setEditing(null)}
                onSend={async (encoded) => {
                  const r = await editMessage(m.id, encoded);
                  if (!r.ok) return r.error ?? "Couldn't save.";
                  setEditing(null);
                  await poll();
                  return null;
                }}
              />
            ) : (
              <>
                {m.segments.length > 0 && <Body segments={m.segments} />}
                <ShareCard m={m} />
              </>
            )}
          </div>
        ))}
        <div ref={bottom} />
      </div>
      {canPost ? (
        <Composer conversationId={conversationId} onSend={send} placeholder={placeholder} />
      ) : (
        <p className="text-sm text-text-muted">Only Admins and Managers can post here.</p>
      )}
    </div>
  );
}
