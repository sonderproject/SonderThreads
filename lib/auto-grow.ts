/** Grows a textarea to fit its text (up to about half the screen), so longer notes don't hide in a tiny scrolling box. */
export function autoGrow(el: HTMLTextAreaElement | null): void {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight + 2, Math.round(window.innerHeight * 0.5))}px`;
}
