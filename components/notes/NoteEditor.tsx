"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Dictate } from "@/components/voice/Dictate";
import { SearchPicker, type PickerOption } from "@/components/ui/SearchPicker";
import { useUndo } from "@/components/ui/UndoToast";
import { NoteText } from "@/components/notes/NoteText";
import { PinIcon } from "@/components/notes/PinIcon";
import { ShareToTeam } from "@/components/messages/ShareToTeam";
import { createNoteSafe, deleteNote, finishNote, restoreNote, setNotePerson, setNotePinned, updateNoteSafe } from "@/lib/actions/notes";
import { PROSE_INPUT } from "@/lib/input-props";
import { autoGrow } from "@/lib/auto-grow";
import type { Note } from "@/lib/types";

const SAVE_DELAY_MS = 800;
/** sessionStorage key for text carried from a quick-note box to /notes/new. */
export const NOTE_DRAFT_KEY = "st_note_draft";
type SaveState = "idle" | "unsaved" | "saving" | "saved" | "error";

/** Wraps the selection in a marker (**bold**, _italic_), or removes it if it's already wrapped. */
function wrapSelection(el: HTMLTextAreaElement, marker: string): { value: string; start: number; end: number } {
  const { value, selectionStart: s, selectionEnd: e } = el;
  const sel = value.slice(s, e);
  const before = value.slice(s - marker.length, s);
  const after = value.slice(e, e + marker.length);
  if (before === marker && after === marker) {
    return { value: value.slice(0, s - marker.length) + sel + value.slice(e + marker.length), start: s - marker.length, end: e - marker.length };
  }
  const text = sel || "text";
  return { value: value.slice(0, s) + marker + text + marker + value.slice(e), start: s + marker.length, end: s + marker.length + text.length };
}

/** Toggles a line prefix ("# ", "- ", "1. ") on every line in the selection. */
function togglePrefix(el: HTMLTextAreaElement, kind: "heading" | "bullet" | "numbered"): { value: string; start: number; end: number } {
  const { value, selectionStart: s, selectionEnd: e } = el;
  const lineStart = value.lastIndexOf("\n", s - 1) + 1;
  const lineEndIdx = value.indexOf("\n", e);
  const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
  const lines = value.slice(lineStart, lineEnd).split("\n");
  const pattern = kind === "heading" ? /^#{1,3}\s+/ : kind === "bullet" ? /^\s*[-*•]\s+/ : /^\s*\d+[.)]\s+/;
  const allHave = lines.every((l) => pattern.test(l));
  const next = lines
    .map((l, i) => {
      const bare = l.replace(/^#{1,3}\s+|^\s*[-*•]\s+|^\s*\d+[.)]\s+/, "");
      if (allHave) return bare;
      return (kind === "heading" ? "# " : kind === "bullet" ? "- " : `${i + 1}. `) + bare;
    })
    .join("\n");
  const out = value.slice(0, lineStart) + next + value.slice(lineEnd);
  return { value: out, start: lineStart, end: lineStart + next.length };
}

/**
 * A note on its own page: a big writing area that saves by itself as you type,
 * with simple formatting (bold, italic, headings, lists), the person it's about, pin and delete.
 * `note` is null for a brand-new note: it's created on the first save, so nothing empty is ever stored.
 */
export function NoteEditor({
  note,
  people,
  initialPersonId = null,
}: {
  note: Note | null;
  people: PickerOption[];
  initialPersonId?: string | null;
}) {
  const router = useRouter();
  const undo = useUndo();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = useState(note?.content ?? "");
  const [noteId, setNoteId] = useState<string | null>(note?.id ?? null);
  const [personId, setPersonId] = useState<string | null>(note?.person_id ?? initialPersonId);
  const [pinned, setPinned] = useState(Boolean(note?.pinned_at));
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  // Refs so the save queue and the leave-page flush always see the latest values.
  const latest = useRef({ content, personId, noteId });
  latest.current = { content, personId, noteId };
  const savedContent = useRef(note?.content ?? "");
  const createdHere = useRef(false);
  const deleted = useRef(false);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    queue.current = queue.current.then(async () => {
      if (deleted.current) return;
      const { content: text, personId: pid, noteId: id } = latest.current;
      if (text === savedContent.current) return setState((s) => (s === "unsaved" ? "saved" : s));
      if (!text.trim()) return setState("idle"); // empty notes aren't saved; the last saved text stays
      setState("saving");
      const result = id
        ? await updateNoteSafe(id, text)
        : await createNoteSafe({ content: text, personId: pid, tzOffset: new Date().getTimezoneOffset(), scanTasks: false });
      if (result.ok) {
        savedContent.current = text;
        setError(null);
        if (!id) {
          createdHere.current = true;
          latest.current.noteId = result.data.id;
          setNoteId(result.data.id);
          // Give the note its own address without reloading the page (keeps the cursor where it is).
          window.history.replaceState(window.history.state, "", `/notes/${result.data.id}`);
        }
        setState(latest.current.content === text ? "saved" : "unsaved");
      } else {
        setError(result.error);
        setState("error");
      }
    });
    return queue.current;
  }, []);

  function change(next: string) {
    setContent(next);
    setState("unsaved");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, SAVE_DELAY_MS);
  }

  // Save on the way out (back button, another page, closing the tab), then look for to-dos
  // in a note that was started here, now that it's finished.
  useEffect(() => {
    const flush = () => {
      if (latest.current.content !== savedContent.current) void save();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
      flush();
      void queue.current.then(() => {
        const id = latest.current.noteId;
        if (id && createdHere.current && !deleted.current) void finishNote(id, new Date().getTimezoneOffset());
      });
    };
  }, [save]);

  // "Open full screen" from a quick-note box carries what was already typed.
  useEffect(() => {
    if (note) return;
    try {
      const draft = sessionStorage.getItem(NOTE_DRAFT_KEY);
      sessionStorage.removeItem(NOTE_DRAFT_KEY);
      if (draft) change(draft);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (!preview) autoGrow(textRef.current, Infinity);
  }, [content, preview]);

  // Cursor position to restore right after a formatting change renders (before the next keystroke).
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);
  useLayoutEffect(() => {
    const sel = pendingSelection.current;
    const el = textRef.current;
    if (!sel || !el) return;
    pendingSelection.current = null;
    el.focus();
    el.setSelectionRange(sel.start, sel.end);
  });

  function apply(edit: { value: string; start: number; end: number }) {
    pendingSelection.current = { start: edit.start, end: edit.end };
    change(edit.value);
  }

  function format(kind: "bold" | "italic" | "heading" | "bullet" | "numbered") {
    const el = textRef.current;
    if (!el) return;
    if (preview) setPreview(false);
    apply(kind === "bold" ? wrapSelection(el, "**") : kind === "italic" ? wrapSelection(el, "_") : togglePrefix(el, kind));
  }

  // Enter in a list continues it; Enter on an empty list item ends the list.
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "b") return e.preventDefault(), format("bold");
    if (mod && e.key.toLowerCase() === "i") return e.preventDefault(), format("italic");
    if (mod && e.key === "Enter") return e.preventDefault(), void save();
    if (e.key !== "Enter" || e.shiftKey || el.selectionStart !== el.selectionEnd) return;
    const { value, selectionStart: pos } = el;
    const lineStart = value.lastIndexOf("\n", pos - 1) + 1;
    const line = value.slice(lineStart, pos);
    const bullet = line.match(/^(\s*[-*•]\s+)/);
    const num = line.match(/^(\s*)(\d+)([.)]\s+)/);
    const prefix = bullet ? bullet[1] : num ? `${num[1]}${Number(num[2]) + 1}${num[3]}` : null;
    if (!prefix) return;
    e.preventDefault();
    const own = bullet ? bullet[1] : num![0];
    if (line.trim() === own.trim()) {
      apply({ value: value.slice(0, lineStart) + value.slice(pos), start: lineStart, end: lineStart });
    } else {
      const at = pos + 1 + prefix.length;
      apply({ value: `${value.slice(0, pos)}\n${prefix}${value.slice(pos)}`, start: at, end: at });
    }
  }

  async function changePerson(next: string | null) {
    setPersonId(next);
    const id = latest.current.noteId;
    if (!id) return; // a new note gets its person when it's first saved
    const result = await setNotePerson(id, next);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  async function togglePin() {
    if (!noteId) await save();
    const id = latest.current.noteId;
    if (!id) return;
    setPinned((p) => !p);
    await setNotePinned(id, !pinned);
  }

  async function remove() {
    const id = latest.current.noteId;
    deleted.current = true;
    if (timer.current) clearTimeout(timer.current);
    if (id) {
      await deleteNote(id);
      undo.show("Note deleted", async () => {
        await restoreNote(id);
        router.refresh();
      });
    }
    router.push("/notes");
    router.refresh();
  }

  function back() {
    if (window.history.length > 1) router.back();
    else router.push("/notes");
  }

  const personName = personId ? people.find((p) => p.id === personId)?.label : null;
  const created = note ? new Date(note.created_at) : null;
  const status =
    state === "saving" ? "Saving…" : state === "unsaved" ? "Editing…" : state === "saved" ? "Saved" : state === "error" ? "Not saved" : "";

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={back}
          className="-ml-2 flex h-9 items-center gap-1 rounded-full px-2 text-sm text-text-muted hover:bg-bg-hover hover:text-text"
        >
          ← Notes
        </button>
        <span className={`ml-auto text-xs ${state === "error" ? "text-danger" : "text-text-faint"}`} aria-live="polite">
          {status}
        </span>
        <button
          type="button"
          onClick={togglePin}
          aria-pressed={pinned}
          aria-label={pinned ? "Unpin note" : "Pin note to the top"}
          title={pinned ? "Unpin" : "Pin to the top"}
          className={`flex h-9 w-9 items-center justify-center rounded-full hover:bg-bg-hover ${pinned ? "text-accent" : "text-text-muted hover:text-accent"}`}
        >
          <PinIcon filled={pinned} size={16} />
        </button>
        {noteId && <ShareToTeam kind="note" id={noteId} className="rounded-full px-3 py-1.5 text-sm text-text-muted hover:bg-bg-hover hover:text-accent" />}
        <button type="button" onClick={remove} className="rounded-full px-3 py-1.5 text-sm text-danger hover:bg-bg-hover">
          Delete
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {personId ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-bg-raised py-0.5 pl-3 pr-1">
            <Link href={`/people/${personId}`} className="text-accent hover:underline">
              {personName ?? "Person"}
            </Link>
            <button
              type="button"
              onClick={() => changePerson(null)}
              aria-label="Make this a standalone note"
              title="Remove person"
              className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted hover:bg-bg-hover hover:text-text"
            >
              ✕
            </button>
          </span>
        ) : (
          <div className="w-full sm:w-72">
            <SearchPicker
              options={people}
              onPick={(o) => changePerson(o.id)}
              placeholder="About someone? Type a name"
              emptyMessage="No one by that name"
            />
          </div>
        )}
        {created && (
          <span className="text-xs text-text-faint">
            {created.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
          </span>
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="sticky top-[calc(env(safe-area-inset-top)+4.25rem)] z-10 flex items-center gap-1 rounded-full border border-border bg-bg-raised p-1 shadow-sm" role="toolbar" aria-label="Formatting">
        {(
          [
            ["bold", "B", "Bold (Ctrl/⌘+B)", "font-bold"],
            ["italic", "I", "Italic (Ctrl/⌘+I)", "italic"],
            ["heading", "H", "Heading", "font-semibold"],
            ["bullet", "•", "Bullet list", ""],
            ["numbered", "1.", "Numbered list", "text-xs"],
          ] as const
        ).map(([kind, label, title, cls]) => (
          <button
            key={kind}
            type="button"
            title={title}
            aria-label={title}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => format(kind)}
            className={`flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm text-text-muted hover:bg-bg-hover hover:text-text ${cls}`}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPreview((p) => !p)}
          aria-pressed={preview}
          className={`ml-auto rounded-full px-3 py-1 text-xs font-medium ${preview ? "bg-accent text-bg" : "text-text-muted hover:bg-bg-hover hover:text-text"}`}
        >
          {preview ? "Edit" : "Preview"}
        </button>
      </div>

      <div className="card px-4 py-3 sm:px-8 sm:py-6">
      {preview ? (
        <div className="min-h-[60vh] cursor-text py-2" onClick={() => setPreview(false)}>
          {content.trim() ? (
            <NoteText content={content} collapse={false} className="text-base leading-relaxed" />
          ) : (
            <p className="text-text-faint">Nothing written yet.</p>
          )}
        </div>
      ) : (
        <Dictate value={content} onChange={change}>
          <textarea
            {...PROSE_INPUT}
            ref={textRef}
            autoFocus={!note}
            value={content}
            onChange={(e) => change(e.target.value)}
            onBlur={() => void save()}
            onKeyDown={onKeyDown}
            placeholder="Start writing…"
            aria-label="Note"
            className="block min-h-[60vh] w-full resize-none border-0 bg-transparent px-0 py-2 text-base leading-relaxed text-text outline-none placeholder:text-text-faint focus:ring-0"
          />
        </Dictate>
      )}
      </div>
    </div>
  );
}

/** Opens a new note on its own page, carrying over anything already typed. */
export function openFullScreenNote(router: { push: (href: string) => void }, text: string, personId?: string | null) {
  try {
    if (text.trim()) sessionStorage.setItem(NOTE_DRAFT_KEY, text);
  } catch {}
  router.push(personId ? `/notes/new?person=${personId}` : "/notes/new");
}
