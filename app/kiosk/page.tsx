import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { queryOne } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { KIOSK_COOKIE } from "@/lib/auth";
import { getMembership } from "@/lib/org";
import { saveKioskSetup, startKiosk } from "@/lib/actions/kiosk";
import { DEFAULT_KIOSK_REASONS } from "@/lib/kiosk-shared";
import { KioskScreen } from "@/components/kiosk/KioskScreen";
import { BrandLockup } from "@/components/BrandLockup";

export const metadata: Metadata = { title: "Check in" };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  "pin-format": "The PIN must be 4 digits.",
  "pin-match": "The two PINs don't match.",
  "no-pin": "Set a PIN first: you'll need it to leave kiosk mode.",
};

/**
 * Front-desk kiosk. Outside kiosk mode: setup (PIN + reasons) and a Start
 * button. In kiosk mode (cookie set by startKiosk): the full-screen
 * self check-in, and the middleware keeps the device on this page.
 */
export default async function KioskPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const userId = await requireUserId();
  const { error, saved } = await searchParams;
  const [inKiosk, settings, membership] = await Promise.all([
    cookies().then((c) => c.get(KIOSK_COOKIE)?.value === "1"),
    queryOne<{ kiosk_pin_hash: string | null; kiosk_reasons: string[] | null }>(
      `select kiosk_pin_hash, kiosk_reasons from user_settings where user_id = $1`,
      [userId],
    ),
    getMembership(),
  ]);
  const reasons = settings?.kiosk_reasons?.length ? settings.kiosk_reasons : DEFAULT_KIOSK_REASONS;
  const org = membership?.active ? membership.orgName : null;
  const logo = org
    ? (await queryOne<{ v: string | null }>(`select extract(epoch from logo_updated_at)::bigint::text as v from organizations where id = $1`, [membership!.orgId]))?.v ?? null
    : null;

  if (inKiosk) {
    return <KioskScreen reasons={reasons} orgName={org} logoVersion={logo} wrongPin={error === "wrong-pin"} />;
  }

  if (!org) {
    return (
      <div className="min-h-screen bg-bg px-4 py-10">
        <div className="mx-auto max-w-md space-y-6">
          <BrandLockup />
          <div className="card space-y-3 p-6">
            <p className="eyebrow text-text-faint">Organization plan</p>
            <h1 className="page-title">Front-desk kiosk</h1>
            <p className="text-sm text-text-muted">
              Turn a tablet into a self check-in screen for your front desk. Clients type their name and pick a reason, and
              the visit lands in your team&apos;s caseload and reports. The kiosk comes with Organization plans.
            </p>
            <Link href="/check-ins" className="inline-block text-sm text-accent hover:underline">
              ← Back to check-ins
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const hasPin = Boolean(settings?.kiosk_pin_hash);
  return (
    <div className="min-h-screen bg-bg px-4 py-10">
      <div className="mx-auto max-w-md space-y-6">
        <BrandLockup />
        <div className="space-y-1">
          <h1 className="page-title">Front-desk kiosk</h1>
          <p className="text-sm text-text-muted">
            Turn this tablet into a self check-in screen. Clients type their name and pick a reason; the check-in lands in your
            caseload{org ? ` (and ${org}'s reports)` : ""}. They never see anyone else&apos;s name.
          </p>
        </div>
        {error && ERRORS[error] && <p className="flag text-sm">{ERRORS[error]}</p>}
        {saved && <p className="text-sm text-accent">Saved.</p>}

        <form action={saveKioskSetup} className="card space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs text-text-muted">{hasPin ? "New PIN (optional)" : "PIN to leave kiosk mode"}</span>
              <input name="pin" inputMode="numeric" pattern="\d{4}" maxLength={4} autoComplete="off" required={!hasPin} className="input tabular-nums" />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-text-muted">Repeat PIN</span>
              <input name="confirm" inputMode="numeric" pattern="\d{4}" maxLength={4} autoComplete="off" required={!hasPin} className="input tabular-nums" />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-xs text-text-muted">Reason buttons clients can tap (one per line, up to 8)</span>
            <textarea name="reasons" rows={5} defaultValue={reasons.join("\n")} className="input" />
          </label>
          <button type="submit" className="rounded-full border border-border px-4 py-1.5 text-sm font-medium text-text hover:bg-bg-hover">
            Save setup
          </button>
        </form>

        <form action={startKiosk} className="space-y-2">
          <button
            type="submit"
            disabled={!hasPin}
            className="w-full rounded-full bg-accent px-4 py-3 text-base font-semibold text-bg hover:bg-accent-dim disabled:opacity-50"
          >
            Start kiosk on this device
          </button>
          <p className="text-center text-xs text-text-muted">
            {hasPin ? "The device stays on the check-in screen until someone enters the PIN." : "Save a PIN first."}
          </p>
        </form>
        <Link href="/check-ins" className="block text-center text-sm text-accent hover:underline">
          ← Back to Check-ins
        </Link>
      </div>
    </div>
  );
}
