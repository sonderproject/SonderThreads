import { redirect } from "next/navigation";
import { query } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { getMembership } from "@/lib/org";
import { billingEnabled, getFreshAccess } from "@/lib/billing";
import { confirmCheckout } from "@/lib/actions/billing";
import { inviteTeamFromSetup, skipTeamStep } from "@/lib/actions/setup";
import { ORG_ROLES, ROLE_HELP, ROLE_LABELS } from "@/lib/org-roles";
import { SetupFrame } from "@/components/setup/SetupFrame";

export const metadata = { title: "Your team · Strynd" };
export const dynamic = "force-dynamic";

/** Organization set-up, step 6 of 7: invite staff (each invite holds a seat), or later. */
export default async function SetupTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; sent?: string; failed?: string }>;
}) {
  const userId = await requireUserId();
  const m = await getMembership();
  if (!m?.active || m.role !== "admin") redirect("/");
  const { checkout, sent, failed } = await searchParams;
  // Back from Stripe: save the subscription now, so invites (which need an active trial) work straight away.
  if (checkout) await confirmCheckout(checkout).catch((err) => console.error("[setup] confirm checkout failed", err));
  const access = await getFreshAccess();
  if (billingEnabled() && access.state === "setup") redirect("/setup/org/plan");
  await query(`update users set setup_step = 'org:team' where id = $1 and setup_step is distinct from 'org:clients'`, [userId]);

  const roles = ORG_ROLES;
  return (
    <SetupFrame
      flow="org"
      step={6}
      title="Invite your team"
      intro="Each person gets an email to join. You can invite more people any time from the Organization page."
    >
      {checkout && <p className="text-sm text-accent">You&apos;re all set: {access.state === "trial" ? "your free trial has started." : "your plan is active."}</p>}
      {failed && (
        <div className="flag space-y-1 text-sm">
          {sent && Number(sent) > 0 && <p>{sent} invite(s) sent. These didn&apos;t go through:</p>}
          {failed.split("\n").map((f) => (
            <p key={f}>{f}</p>
          ))}
        </div>
      )}
      <form action={inviteTeamFromSetup} className="space-y-4">
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-2">
              <input type="email" name="email" placeholder={i === 0 ? "teammate@example.org" : "Email"} autoComplete="off" className="input flex-1" />
              <select name="role" defaultValue="case_manager" className="input w-36" aria-label="Role">
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <ul className="space-y-1 text-xs text-text-muted">
          {roles.map((r) => (
            <li key={r}>
              <strong className="text-text">{ROLE_LABELS[r]}:</strong> {ROLE_HELP[r]}
            </li>
          ))}
        </ul>
        {/* The main button comes first, so pressing Enter sends the invites. */}
        <div className="flex flex-row-reverse items-center justify-between gap-3 pt-2">
          <button type="submit" className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-bg hover:bg-accent-dim">
            Send invites
          </button>
          <button formAction={skipTeamStep} formNoValidate className="text-sm text-text-muted hover:text-text">
            I&apos;ll do this later
          </button>
        </div>
      </form>
    </SetupFrame>
  );
}
