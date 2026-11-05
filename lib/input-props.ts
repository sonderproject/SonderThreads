/**
 * Keyboard behavior for text fields (mostly matters on phones).
 * Spread onto <input>/<textarea>: <input {...NAME_INPUT} … />
 */

/** People's names: capitalize each word, never "fix" an unusual name. */
export const NAME_INPUT = {
  autoCapitalize: "words",
  autoCorrect: "off",
  spellCheck: false,
} as const;

/** Notes, tasks, reasons, statuses: normal writing with autocorrect and spell check. */
export const PROSE_INPUT = {
  autoCapitalize: "sentences",
  autoCorrect: "on",
  spellCheck: true,
} as const;

/** Search boxes: type exactly what you mean, no capitals or corrections. */
export const SEARCH_INPUT = {
  autoCapitalize: "none",
  autoCorrect: "off",
  spellCheck: false,
} as const;
