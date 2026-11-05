/**
 * Status pill. The tone carries meaning, so use it consistently:
 * urgent (red) = overdue / act now, attention (amber) = due today, follow up,
 * stale, new (blue) = added recently or unread, neutral = plain label.
 */
export type BadgeTone = "neutral" | "urgent" | "attention" | "new";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-bg-hover text-text-muted",
  urgent: "tag-u",
  attention: "tag-e",
  new: "tag-n",
};

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: BadgeTone }) {
  return <span className={`tag ${TONES[tone]}`}>{children}</span>;
}
