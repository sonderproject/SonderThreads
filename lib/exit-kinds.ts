/**
 * Exits, the parts with no database access (safe for client components and tests).
 * Every exit reason belongs to one group. "Unplanned" is the third group on purpose:
 * it describes what happened (the exit wasn't the plan) without calling it a failure.
 */
export type ExitKind = "positive" | "neutral" | "unplanned";

export const EXIT_KINDS: { kind: ExitKind; label: string; hint: string }[] = [
  { kind: "positive", label: "Positive", hint: "Reached a goal: a job, housing, a finished program or project" },
  { kind: "neutral", label: "Neutral", hint: "Moved on for other reasons: moved away, transferred, program ended" },
  { kind: "unplanned", label: "Unplanned", hint: "Left before the plan was done: lost contact, chose someone else" },
];

export function isExitKind(v: unknown): v is ExitKind {
  return v === "positive" || v === "neutral" || v === "unplanned";
}

export const exitKindLabel = (k: ExitKind) => EXIT_KINDS.find((x) => x.kind === k)!.label;

/** Suggested reasons, filled in the first time an account opens its list. Admins rename, regroup or retire them. */
export const DEFAULT_EXIT_REASONS: Record<"nonprofit" | "business" | "individual", [string, ExitKind][]> = {
  nonprofit: [
    ["Got a job", "positive"],
    ["Found permanent housing", "positive"],
    ["Received rental assistance", "positive"],
    ["Moved in with family or friends", "positive"],
    ["Completed program", "positive"],
    ["Moved out of area", "neutral"],
    ["Transferred to another program", "neutral"],
    ["Program ended", "neutral"],
    ["Lost contact", "unplanned"],
    ["Left the program early", "unplanned"],
    ["Didn't meet eligibility", "unplanned"],
  ],
  business: [
    ["Reached their goal", "positive"],
    ["Finished their package or project", "positive"],
    ["Moved away", "neutral"],
    ["Taking a break", "neutral"],
    ["Needs changed", "neutral"],
    ["Chose another company", "unplanned"],
    ["Price", "unplanned"],
    ["Wasn't the right fit", "unplanned"],
    ["Stopped responding", "unplanned"],
  ],
  individual: [
    ["Project finished", "positive"],
    ["Goal reached", "positive"],
    ["Moved on", "neutral"],
    ["Chose someone else", "unplanned"],
    ["Stopped responding", "unplanned"],
  ],
};

/** Share of each group, rounded so the three add up to 100 (largest remainder). */
export function kindShares(counts: Record<ExitKind, number>): Record<ExitKind, number> {
  const total = counts.positive + counts.neutral + counts.unplanned;
  if (!total) return { positive: 0, neutral: 0, unplanned: 0 };
  const kinds: ExitKind[] = ["positive", "neutral", "unplanned"];
  const raw = kinds.map((k) => (counts[k] / total) * 100);
  const floor = raw.map(Math.floor);
  let left = 100 - floor.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - floor[i], i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left <= 0) break;
    floor[i]++;
    left--;
  }
  return { positive: floor[0], neutral: floor[1], unplanned: floor[2] };
}
