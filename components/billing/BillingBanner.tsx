import Link from "next/link";
import type { Access } from "@/lib/billing";

function daysLeft(d: Date | null): number {
  return d ? Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86_400_000)) : 0;
}

/** Top-of-page note for trials ending, failed payments and view-only accounts. */
export function BillingBanner({ access: a }: { access: Access }) {
  let text: string | null = null;
  let tone = "border-border bg-bg-raised";
  const days = daysLeft(a.endsAt);
  if (a.state === "trial" && (a.scope === "individual" || (a.canManage && days <= 10))) {
    text = `Free trial: ${days} ${days === 1 ? "day" : "days"} left.`;
  } else if (a.state === "grace" && a.canManage) {
    text = `Your last payment didn't go through. Update your card within ${days} ${days === 1 ? "day" : "days"} to keep full access.`;
    tone = "flag";
  } else if (a.state === "readonly") {
    text =
      a.scope === "org" && !a.canManage
        ? !a.row?.stripe_subscription_id && a.endsAt === null
          ? `${a.orgName}'s free trial hasn't started yet. Ask your admin to start it in Billing.`
          : `${a.orgName}'s subscription has ended, so Strynd is view-only. Ask your admin to renew it.`
        : "Your free trial has ended, so Strynd is view-only. Everything is still here.";
    tone = "flag";
  }
  if (!text) return null;
  return (
    <div className={`mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-2.5 text-sm ${tone}`}>
      <span>{text}</span>
      {a.canManage && (
        <Link href="/billing" className="font-semibold text-accent hover:underline">
          {a.state === "grace" ? "Update payment →" : "Subscribe →"}
        </Link>
      )}
    </div>
  );
}
