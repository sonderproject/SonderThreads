import Link from "next/link";
import { acceptInviteInApp, declineInviteInApp } from "@/lib/actions/org";
import { ROLE_LABELS } from "@/lib/org-roles";
import type { PendingInvite } from "@/lib/org";

/** "You're invited" cards for the signed-in person, so joining never depends on an email arriving. */
export function PendingInvites({ invites, error }: { invites: PendingInvite[]; error?: string }) {
  if (!invites.length && !error) return null;
  return (
    <div className="space-y-3">
      {error === "other-org" && (
        <p className="flag text-sm">You&apos;re already in another organization. Ask its admin to deactivate you first.</p>
      )}
      {error === "agree" && <p className="flag text-sm">Please tick the box to confirm before joining.</p>}
      {error === "invalid" && <p className="flag text-sm">That invite has expired or was already used.</p>}
      {error === "seats" && (
        <p className="flag text-sm">That organization has no free seats right now. Ask its admin to add a seat in Billing, then try again.</p>
      )}
      {invites.map((i) => (
        <section key={i.id} className="card space-y-3 border-accent p-5" style={{ borderColor: "var(--accent)" }}>
          <p className="section-label">Invitation</p>
          <p className="font-display text-xl font-light text-text">
            {i.inviter ? `${i.inviter} invited you` : "You're invited"} to join <strong className="font-medium">{i.orgName}</strong> as{" "}
            {ROLE_LABELS[i.role].toLowerCase()}.
          </p>
          <p className="text-xs text-text-muted">
            Clients you choose (and new ones you add) will belong to {i.orgName}. Your personal tasks, notes and lists stay private.
          </p>
          <div className="flex flex-wrap gap-2">
            <form action={acceptInviteInApp} className="w-full space-y-3">
              <input type="hidden" name="invite_id" value={i.id} />
              <label className="flex items-start gap-2 text-xs text-text-muted">
                <input type="checkbox" name="agree" required className="mt-0.5" />
                <span>
                  I&apos;ll follow the{" "}
                  <Link href="/terms" target="_blank" className="text-accent hover:underline">
                    Terms of service
                  </Link>
                  , the{" "}
                  <Link href="/privacy" target="_blank" className="text-accent hover:underline">
                    Privacy policy
                  </Link>{" "}
                  and {i.orgName}&apos;s rules when handling client information.
                </span>
              </label>
              <button type="submit" className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-bg hover:bg-accent-dim">
                Join {i.orgName}
              </button>
            </form>
            <form action={declineInviteInApp}>
              <input type="hidden" name="invite_id" value={i.id} />
              <button type="submit" className="rounded-full border border-border px-4 py-2 text-sm font-medium text-text-muted hover:bg-bg-hover">
                Decline
              </button>
            </form>
          </div>
        </section>
      ))}
    </div>
  );
}
