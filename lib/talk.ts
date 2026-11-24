/** Team-size choices on the "Talk to us" form (/talk). */
export const TALK_SIZES = ["1–5", "6–20", "21–50", "50+"] as const;

/** Link to /talk from a marketing page, so the owner sees which page the request came from. */
export function talkHref(from: string): string {
  return `/talk?from=${encodeURIComponent(from)}`;
}
