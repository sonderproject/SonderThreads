/**
 * Is this a plausible email address? Checks the length first: the pattern
 * backtracks on long inputs (a 50,000-character string of dots took over 4
 * seconds), and real addresses are at most 254 characters.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(value: string): boolean {
  return value.length > 0 && value.length <= 254 && EMAIL_PATTERN.test(value);
}
