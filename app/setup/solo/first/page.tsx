import { requireUserId } from "@/lib/current-user";
import { finishSoloSetup } from "@/lib/actions/setup";
import { SetupFrame } from "@/components/setup/SetupFrame";

export const metadata = { title: "Your first person · Strynd" };
export const dynamic = "force-dynamic";

/** Individual set-up, step 4 of 4 (last): add the first person, or skip. */
export default async function SoloFirstPage({ searchParams }: { searchParams: Promise<{ offer?: string }> }) {
  await requireUserId();
  const { offer } = await searchParams;
  return (
    <SetupFrame
      flow="solo"
      step={4}
      title="Who's the first person you want to keep track of?"
      intro="A client, a customer, a friend. Add notes, reminders and visits to them once you're in."
    >
      <form action={finishSoloSetup} className="space-y-4">
        {offer === "skip" && <input type="hidden" name="offer" value="skip" />}
        <input name="name" maxLength={200} autoFocus placeholder="Full name, e.g. Ana Lopez" className="input" />
        {/* The main button comes first, so pressing Enter adds the person. */}
        <div className="flex flex-row-reverse items-center justify-between gap-3 pt-2">
          <button type="submit" className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-bg hover:bg-accent-dim">
            Add and start
          </button>
          <button name="skip" value="1" className="text-sm text-text-muted hover:text-text">
            Skip for now
          </button>
        </div>
      </form>
    </SetupFrame>
  );
}
