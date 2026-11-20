/**
 * Grows a textarea to fit its text, so longer notes don't hide in a tiny scrolling box.
 * Capped at about half the screen by default; pass Infinity to grow without limit (a note's own page).
 */
export function autoGrow(el: HTMLTextAreaElement | null, max = Math.round(window.innerHeight * 0.5)): void {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight + 2, max)}px`;
}
