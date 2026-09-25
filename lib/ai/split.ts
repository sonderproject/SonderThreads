/** Words that end in a period without ending a sentence. */
const ABBREVIATIONS = /(?:^|\s)(?:mr|mrs|ms|dr|st|jr|sr|vs|etc|approx|a\.m|p\.m|[a-z])\.$/i;

/**
 * Splits a brain dump into separate commands: one per line, per semicolon,
 * or per sentence ("Call Marcus Friday. Buy printer ink. Wes starts
 * Monday."). Commas never split — "Add Marcus, James and Wes to Group 7"
 * is one command. Trailing sentence punctuation is dropped, which also
 * cleans up voice transcripts that end every command with a period.
 */
export function splitCommands(text: string): string[] {
  const pieces: string[] = [];
  for (const line of text.split(/\n+|;/)) {
    let current = "";
    const chunks = line.split(/(?<=[.!?])\s+/);
    chunks.forEach((chunk, i) => {
      current = current ? `${current} ${chunk}` : chunk;
      const next = chunks[i + 1];
      // "at 3 p.m. Then…" — a capitalised word after a.m./p.m. starts a new sentence.
      const sentenceAfterTime = /[ap]\.m\.$/i.test(current) && !!next && /^[A-Z]/.test(next);
      if (!ABBREVIATIONS.test(current) || sentenceAfterTime) {
        pieces.push(current);
        current = "";
      }
    });
    if (current) pieces.push(current);
  }

  const cleaned = pieces.map((p) => p.trim().replace(/[.!?]+$/, "").trim()).filter(Boolean);

  // A one-word fragment ("Thanks.") isn't a command on its own — keep it with the previous one.
  const out: string[] = [];
  for (const p of cleaned) {
    if (out.length && !/\s/.test(p)) out[out.length - 1] += ` ${p}`;
    else out.push(p);
  }
  return out;
}
