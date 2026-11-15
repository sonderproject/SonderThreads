import { answerMarketingPrompt } from "@/lib/actions/announce";
import { MARKETING_WORDING } from "@/lib/marketing-wording";

/** One-time question for existing accounts: marketing emails are opt-in only. */
export function MarketingPrompt() {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-bg-raised px-4 py-2.5 text-sm">
      <p className="min-w-0">{MARKETING_WORDING}</p>
      <form action={answerMarketingPrompt} className="flex shrink-0 gap-2">
        <button name="answer" value="yes" className="rounded-full bg-accent px-3 py-1 font-semibold text-bg hover:bg-accent-dim">
          Yes, email me
        </button>
        <button name="answer" value="no" className="rounded-full px-3 py-1 text-text-muted hover:bg-bg-hover hover:text-text">
          No thanks
        </button>
      </form>
    </div>
  );
}
