import { redirect, unstable_rethrow } from "next/navigation";
import { TermsProvider } from "@/components/TermsProvider";
import { headers } from "next/headers";
import { AppShell } from "@/components/nav/AppShell";
import { TimeZoneProvider } from "@/components/TimeZoneProvider";
import { getTimeZone } from "@/lib/timezone";
import { checkSetup } from "@/lib/actions/diagnostics";
import { SetupIssuePanel } from "@/components/diagnostics/SetupIssuePanel";
import { listPeople } from "@/lib/actions/people";
import { listLists } from "@/lib/actions/lists";
import { getNotificationCount } from "@/lib/actions/notifications";
import { requireUserId } from "@/lib/current-user";
import { queryOne } from "@/lib/db/client";
import { TwoFactorPrompt } from "@/components/settings/TwoFactorPrompt";
import { getUserSettings } from "@/lib/settings";
import { getMembership } from "@/lib/org";
import { countNewReferrals } from "@/lib/referrals";
import { billingEnabled, getAccess } from "@/lib/billing";
import { BillingBanner } from "@/components/billing/BillingBanner";
import { pendingAgreements } from "@/lib/actions/legal";
import { SETUP_PATHS } from "@/lib/setup";
import { isOwner } from "@/lib/owner";

/**
 * Two per-user flags, in one read: whether to offer optional 2FA (from day 3,
 * at most once every 30 days), and an unfinished guided set-up to send them back to.
 */
async function userFlags(): Promise<{ offerTwoFactor: boolean; setupStep: string | null; draftFlow: string | null }> {
  const userId = await requireUserId();
  const row = await queryOne<{ offer: boolean; setup_step: string | null; draft_flow: string | null }>(
    `select setup_step, setup_draft->>'flow' as draft_flow, (not mfa_enabled
             -- Not on day one: let new people try the app before asking about security settings.
             and created_at < now() - interval '3 days'
             and (mfa_prompt_dismissed_at is null or mfa_prompt_dismissed_at < now() - interval '30 days')) as offer
     from users where id = $1`,
    [userId],
  );
  return { offerTwoFactor: Boolean(row?.offer), setupStep: row?.setup_step ?? null, draftFlow: row?.draft_flow ?? null };
}

// This whole route group is a live, per-user dashboard — never prerender it.
export const dynamic = "force-dynamic";

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  // Load straight away; only run the database diagnostic if that fails.
  // (Checking first added a full database round trip before every page.)
  let data;
  try {
    // Everything the shell needs, fetched together (the Terms and billing checks used to wait for the rest).
    data = await Promise.all([
      listPeople(), listLists(), getNotificationCount(), getTimeZone(), userFlags(), getUserSettings(), getMembership(),
      pendingAgreements(), getAccess().catch(() => null), isOwner().catch(() => false),
    ]);
  } catch (err) {
    unstable_rethrow(err); // let Next's redirect-to-sign-in through
    const diagnostic = await checkSetup();
    if (diagnostic.ok) throw err;
    return (
      <AppShell>
        <SetupIssuePanel diagnostic={diagnostic} />
      </AppShell>
    );
  }

  const [people, lists, notificationCount, timeZone, flags, settings, membership, agreements, access, showOwner] = data;
  // Everyone agrees to the current Terms/Privacy policy (and admins for their organization) before using the app.
  if (agreements.user || agreements.org) {
    const path = (await headers()).get("x-pathname") ?? "/";
    if (!path.startsWith("/settings/data")) redirect(`/accept-terms?next=${encodeURIComponent(path)}`);
  }
  // An unfinished guided set-up (lib/setup.ts) comes first: back to the step where they stopped.
  // Set-up answers saved at sign-up but not applied yet (e.g. they tapped Confirm in the
  // email, which lands on Home): finish the set-up first, which creates their organization.
  const finishPath = flags.draftFlow === "org" || flags.draftFlow === "solo" ? `/setup/${flags.draftFlow}/finish` : undefined;
  const setupPath = flags.setupStep ? SETUP_PATHS[flags.setupStep] : finishPath;
  if (setupPath) {
    const path = (await headers()).get("x-pathname") ?? "";
    // Settings and Billing stay reachable, so nobody is ever stuck (e.g. if checkout fails).
    if (!["/owner", "/settings", "/billing"].some((p) => path.startsWith(p))) redirect(setupPath);
  }
  const offerTwoFactor = flags.offerTwoFactor;
  // New organizations start their free trial (card on Stripe) before using the app; individuals try it first without a card.
  if (access?.state === "setup") {
    const path = (await headers()).get("x-pathname") ?? "";
    const open = ["/billing", "/settings", "/organization/new", "/join", "/invites", "/owner"].some((p) => path.startsWith(p));
    if (!open) redirect("/billing");
  }
  const referralCount =
    membership?.active && membership.role === "admin" ? await countNewReferrals(membership.orgId).catch(() => 0) : null;
  return (
    <TimeZoneProvider timeZone={timeZone}>
    <TermsProvider audience={membership?.active ? membership.orgKind : "individual"}>
    <AppShell
      people={people.map((p) => ({ id: p.id, display_name: p.display_name }))}
      lists={lists.map((l) => ({ id: l.id, name: l.name }))}
      notificationCount={notificationCount}
      idleMinutes={settings.staySignedIn ? null : settings.idleTimeoutMinutes}
      showTeam={Boolean(membership?.active && membership.role !== "case_manager")}
      referralCount={referralCount}
      showImpact={!(membership?.active && membership.role === "case_manager")}
      showOwner={showOwner}
    >
      {access && billingEnabled() && <BillingBanner access={access} />}
      {children}
      {offerTwoFactor && <TwoFactorPrompt />}
    </AppShell>
    </TermsProvider>
    </TimeZoneProvider>
  );
}
