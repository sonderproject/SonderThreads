"use client";

import { useEffect } from "react";
import { correctionBefore } from "@/lib/autocorrect";

/** Text fields autocorrect works in: plain text boxes, never emails, links, numbers, passwords or codes. */
function eligible(el: EventTarget | null): el is HTMLInputElement | HTMLTextAreaElement {
  // Fields that switch spell check off themselves (names, codes, domains) are skipped too.
  if (!(el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement)) return false;
  if (el.getAttribute("spellcheck") === "false" || el.closest("[data-no-autocorrect]")) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  return (el.type === "text" || el.type === "search") && !/email|url|tel|one-time-code|username|name/.test(el.autocomplete);
}

/** Sets a field's text the way React notices (so forms keep the change). */
function setFieldValue(el: HTMLInputElement | HTMLTextAreaElement, value: string, caret: number) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.setSelectionRange(caret, caret);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Settings → Account → Typing. Spell check: the browser underlines misspelled words in every
 * text field (fields that opt out, like email addresses and codes, stay off). Autocorrect: as
 * a word is finished, common typos are fixed (lib/autocorrect.ts); Backspace right after a fix
 * puts the original word back, like on a phone.
 */
export function TypingAssist({ spellcheck, autocorrect }: { spellcheck: boolean; autocorrect: boolean }) {
  useEffect(() => {
    document.body.spellcheck = spellcheck;
    // Safari/iPhone's own autocorrect follows the same choice.
    document.body.setAttribute("autocorrect", autocorrect ? "on" : "off");
  }, [spellcheck, autocorrect]);

  useEffect(() => {
    if (!autocorrect) return;
    let last: { el: HTMLInputElement | HTMLTextAreaElement; start: number; word: string; fix: string; caret: number } | null = null;
    let applying = false;

    const onInput = (e: Event) => {
      if (applying) return;
      const ev = e as InputEvent;
      const el = e.target;
      if (!eligible(el) || ev.inputType !== "insertText" || !ev.data || el.selectionStart !== el.selectionEnd) {
        last = null;
        return;
      }
      const caret = el.selectionStart ?? 0;
      const c = correctionBefore(el.value, caret);
      if (!c) {
        last = null;
        return;
      }
      const value = el.value.slice(0, c.start) + c.fix + el.value.slice(c.end);
      const newCaret = caret + (c.fix.length - c.word.length);
      applying = true;
      setFieldValue(el, value, newCaret);
      applying = false;
      last = { el, start: c.start, word: c.word, fix: c.fix, caret: newCaret };
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!last) return;
      const el = e.target;
      if (e.key === "Backspace" && el === last.el && last.el.selectionStart === last.caret && last.el.selectionEnd === last.caret) {
        const { start, word, fix, caret } = last;
        const v = last.el.value;
        if (v.slice(start, start + fix.length) === fix) {
          e.preventDefault();
          // Undo the fix and keep the space/punctuation that was typed after it.
          const value = v.slice(0, start) + word + v.slice(start + fix.length);
          applying = true;
          setFieldValue(last.el, value, caret - fix.length + word.length);
          applying = false;
        }
      }
      if (e.key !== "Shift") last = null;
    };

    document.addEventListener("input", onInput, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [autocorrect]);

  return null;
}
