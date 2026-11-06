/**
 * Forgiving search used everywhere (search palette, filter boxes, exports).
 *
 * Every word you type must match some word in the item, but a match can be:
 *   exact ("jordan")                         -> best
 *   the start of a word ("jor")              -> very good
 *   inside a word ("dan" in "jordan")        -> good
 *   a typo away ("jordon", "pryia", "jrodan") -> still found, ranked lower
 * Case, accents and punctuation are ignored. Allowed typos scale with word
 * length: none for 1–2 letters, 1 for 3–5, 2 for 6+.
 */

export type FuzzyField = string | null | undefined | { text: string | null | undefined; weight: number };

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9@#]+/g, " ")
    .trim();

const words = (s: string) => (s ? s.split(" ") : []);

function allowedTypos(len: number): number {
  return len <= 2 ? 0 : len <= 5 ? 1 : 2;
}

/** Optimal string alignment distance (Levenshtein + adjacent swaps), stopping early past `max`. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows: number[][] = [];
  for (let i = 0; i <= a.length; i++) rows.push([i]);
  for (let j = 1; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, rows[i - 2][j - 2] + 1);
      rows[i][j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
  }
  return rows[a.length][b.length];
}

/** How well one typed word matches one word of the text, 0 = no match. */
function wordScore(token: string, word: string): number {
  if (word === token) return 1;
  if (word.startsWith(token)) return 0.9;
  if (token.length >= 3 && word.includes(token)) return 0.75;
  const max = allowedTypos(token.length);
  if (max === 0) return 0;
  // A typo in the whole word...
  const whole = editDistance(token, word, max);
  if (whole <= max) return 0.65 - 0.12 * whole;
  // ...or in the start of a longer word, for half-typed names ("jrod" -> "jordan").
  if (word.length > token.length) {
    const start = editDistance(token, word.slice(0, token.length), max);
    if (start <= max) return 0.55 - 0.12 * start;
  }
  return 0;
}

/** A query prepared once, scored against many items. */
export function fuzzyMatcher(query: string) {
  const tokens = words(normalize(query));
  return (fields: FuzzyField[]): number => {
    if (tokens.length === 0) return 1;
    const prepared = fields
      .map((f) => (typeof f === "object" && f !== null ? f : { text: f, weight: 1 }))
      .filter((f): f is { text: string; weight: number } => Boolean(f.text))
      .map((f) => ({ norm: normalize(f.text), weight: f.weight }));
    let total = 0;
    for (const token of tokens) {
      let best = 0;
      for (const f of prepared) {
        // Fast path: an exact substring anywhere in the field.
        if (f.norm.includes(token)) {
          const exact = words(f.norm).some((w) => w === token || w.startsWith(token));
          best = Math.max(best, (exact ? 0.95 : 0.75) * f.weight);
          if (best >= f.weight) continue;
        }
        for (const w of words(f.norm)) {
          if (Math.abs(w.length - token.length) > 2 && !w.startsWith(token.slice(0, 2))) continue;
          const s = wordScore(token, w) * f.weight;
          if (s > best) best = s;
        }
      }
      if (best === 0) return 0; // every typed word must match something
      total += best;
    }
    return total / tokens.length;
  };
}

/**
 * Items matching `query`, best match first (ties keep their original order).
 * An empty query returns the items unchanged.
 */
export function fuzzyFilter<T>(items: T[], query: string, fields: (item: T) => FuzzyField[], limit?: number): T[] {
  if (!query.trim()) return limit ? items.slice(0, limit) : items;
  const score = fuzzyMatcher(query);
  const ranked = items
    .map((item, i) => ({ item, i, s: score(fields(item)) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((r) => r.item);
  return limit ? ranked.slice(0, limit) : ranked;
}
