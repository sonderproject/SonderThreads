/**
 * Command bar: does a note about someone mention one of the account's outcomes?
 * "Marcus got the job at Amazon" → "Got a job". Every key word of the outcome's
 * name must appear in the note (or a close form: "complete" for "completed",
 * "hired" for "job"), so suggestions stay rare and right. The person still
 * confirms with one tap; nothing is recorded automatically. No imports, so the
 * tests can load it directly.
 */
const STOP = new Set(["a", "an", "the", "to", "in", "into", "for", "with", "of", "on", "at", "their", "his", "her", "my", "our", "your", "new"]);

/** Words that mean the same thing in a note. */
const ALSO: Record<string, string[]> = {
  job: ["job", "hired", "employed", "employment", "position", "work"],
  got: ["got", "gets", "getting", "landed", "found", "started", "hired"],
  housing: ["housing", "housed", "apartment", "home", "lease"],
  found: ["found", "got", "moved", "signed"],
  completed: ["completed", "complete", "finished", "graduated"],
  program: ["program", "programme", "course", "class", "training"],
  enrolled: ["enrolled", "enroll", "approved", "signed", "qualified"],
  benefits: ["benefits", "snap", "medicaid", "calfresh", "wic", "ssi", "ssdi"],
  regular: ["regular", "regulars", "weekly", "monthly"],
  membership: ["membership", "member", "subscribed", "subscription"],
  joined: ["joined", "signed", "bought", "started"],
  referred: ["referred", "sent", "brought"],
};

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);

function hasWord(noteWords: string[], key: string): boolean {
  const forms = ALSO[key] ?? [key];
  return forms.some((f) => noteWords.some((w) => w === f || (f.length >= 5 && w.startsWith(f.slice(0, f.length - 1)))));
}

export function matchOutcome<T extends { id: string; name: string }>(note: string, outcomes: T[]): T | null {
  const noteWords = words(note);
  let best: { o: T; n: number } | null = null;
  for (const o of outcomes) {
    const keys = words(o.name).filter((w) => !STOP.has(w));
    if (!keys.length) continue;
    if (keys.every((k) => hasWord(noteWords, k)) && (!best || keys.length > best.n)) best = { o, n: keys.length };
  }
  return best?.o ?? null;
}
