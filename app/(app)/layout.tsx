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

/** Offer optional 2FA to people who don't have it on, at most once every 30 days. */
async function shouldOfferTwoFactor(): Promise<boolean> {
  const userId = await requireUserId();
  const row = await queryOne<{ offer: boolean }>(
    `select (not mfa_enabled
             and (mfa_prompt_dismissed_at is null or mfa_prompt_dismissed_at < now() - interval '30 days')) as offer
     from users where id = $1`,
    [userId],
  );
  return Boolean(row?.offer);
}

// This whole route group is a live, per-user dashboard — never prerender it.
export const dynamic = "force-dynamic";

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  // Load straight away; only run the database diagnostic if that fails.
  // (Checking first added a full database round trip before every page.)
  let data;
  try {
    data = await Promise.all([listPeople(), listLists(), getNotificationCount(), getTimeZone(), shouldOfferTwoFactor(), getUserSettings(), getMembership()]);
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

  const [people, lists, notificationCount, timeZone, offerTwoFactor, settings, membership] = data;
  const access = await getAccess().catch(() => null);
  // New individual accounts start their free trial (card on Stripe) before using the app.
  if (access?.state === "setup") {
    const path = (await headers()).get("x-pathname") ?? "";
    const open = ["/billing", "/settings", "/organization/new", "/join", "/invites", "/owner"].some((p) => path.startsWith(p));
    if (!open) redirect("/billing");
  }
  const referralCount =
    membership?.active && membership.role === "admin" ? await countNewReferrals(membership.orgId).catch(() => 0) : null;
  return (
    <TimeZoneProvider timeZone={timeZone}>
    <TermsProvider isOrg={Boolean(membership?.active)}>
    <AppShell
      people={people.map((p) => ({ id: p.id, display_name: p.display_name }))}
      lists={lists.map((l) => ({ id: l.id, name: l.name }))}
      notificationCount={notificationCount}
      idleMinutes={settings.staySignedIn ? null : settings.idleTimeoutMinutes}
      showTeam={Boolean(membership?.active && membership.role !== "case_manager")}
      referralCount={referralCount}
      showImpact={!(membership?.active && membership.role === "case_manager")}
    >
      {access && billingEnabled() && <BillingBanner access={access} />}
      {children}
      {offerTwoFactor && <TwoFactorPrompt />}
    </AppShell>
    </TermsProvider>
    </TimeZoneProvider>
  );
}
