"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Modal } from "@/components/ui/Modal";
import { acceptSaveOffer, cancelSubscription } from "@/lib/actions/billing";

function Submit({ children, className }: { children: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} w-full disabled:opacity-60`}>
      {pending ? "One moment…" : children}
    </button>
  );
}

const primary = "rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-bg hover:bg-accent-dim";
const plain = "rounded-full border border-border px-5 py-2.5 text-sm font-medium text-text hover:bg-bg-hover";

/**
 * Cancel is always one visible button and at most one more click. Eligible
 * individuals see the one-time "$5 for 2 months" offer first, with
 * "No thanks, cancel" right beside it, so the offer never stands in the way.
 */
export function CancelSubscriptionButton({
  offer,
  accessUntil,
  trialing,
}: {
  offer: boolean;
  accessUntil: string;
  trialing: boolean;
}) {
  const [open, setOpen] = useState(false);
  const after = trialing
    ? `Your free trial keeps running until ${accessUntil}, and you won't be charged.`
    : `You keep full access until ${accessUntil}, and you won't be charged again.`;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-full border border-danger px-4 py-2 text-sm font-medium text-danger hover:bg-bg-hover">
        Cancel subscription
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={offer ? "Before you go" : "Cancel subscription?"}>
        {offer ? (
          <div className="space-y-4">
            <div className="space-y-2 rounded-2xl bg-accent-soft p-4">
              <p className="eyebrow text-accent">A thank-you, just for you</p>
              <p className="font-display text-3xl font-light tabular-nums text-text">
                $5<span className="ml-1 font-sans text-base text-text-muted">/ month for 2 months</span>
              </p>
              <p className="text-sm text-text-muted">Less than a cup of coffee. Then it's $9 a month again, and you can still cancel any time.</p>
            </div>
            <form action={acceptSaveOffer}>
              <Submit className={primary}>Keep Strynd for $5</Submit>
            </form>
            <form action={cancelSubscription}>
              <Submit className={plain}>No thanks, cancel</Submit>
            </form>
            <p className="text-xs text-text-muted">If you cancel: {after}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-text-muted">{after} Your data stays yours: you can still see and export everything.</p>
            <form action={cancelSubscription}>
              <Submit className="rounded-full border border-danger px-5 py-2.5 text-sm font-semibold text-danger hover:bg-bg-hover">
                Cancel subscription
              </Submit>
            </form>
            <button type="button" onClick={() => setOpen(false)} className={`${plain} w-full`}>
              Keep my plan
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}
