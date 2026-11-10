import type { Metadata } from "next";
import { queryOne } from "@/lib/db/client";
import { submitReferral } from "@/lib/actions/referrals";

export const metadata: Metadata = { title: "Refer a client", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  name: "Enter the client's first and last name.",
  phone: "Enter a phone number for the client.",
  dob: "Enter the client's date of birth.",
  referrer: "Enter your name and department.",
  busy: "Too many referrals from this device just now. Please try again in a little while.",
};

/** Public referral form for an organization (no sign-in). Shows nothing but the form. */
export default async function ReferPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { code } = await params;
  const { sent, error } = await searchParams;
  const org = await queryOne<{ name: string; has_logo: boolean }>(
    `select name, logo is not null as has_logo from organizations where referral_code = $1 and referral_enabled`,
    [code],
  );

  return (
    <div className="min-h-screen bg-bg px-4 py-10 text-text">
      <main className="mx-auto max-w-md space-y-6">
        {!org || error === "closed" ? (
          <div className="card space-y-2 p-6 text-center">
            <h1 className="page-title">Link not active</h1>
            <p className="text-sm text-text-muted">
              This referral link isn&apos;t active. Ask the team that sent it for a new one.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2 text-center">
              {org.has_logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/refer/${encodeURIComponent(code)}/logo`} alt="" className="mx-auto max-h-14 max-w-48 object-contain" />
              )}
              <p className="eyebrow text-text-faint">{org.name}</p>
              <h1 className="page-title">Refer a client</h1>
            </div>

            {sent ? (
              <div className="card space-y-3 p-6 text-center">
                <p className="font-display text-xl">Thank you, the team has it.</p>
                <p className="text-sm text-text-muted">{org.name} will reach out to the client.</p>
                <a href={`/refer/${encodeURIComponent(code)}`} className="inline-block text-sm text-accent hover:underline">
                  Refer another client
                </a>
              </div>
            ) : (
              <form action={submitReferral} className="card space-y-5 p-5">
                <input type="hidden" name="code" value={code} />
                {/* Spam trap: hidden from people. */}
                <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                  <label>
                    Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
                  </label>
                </div>

                {error && ERRORS[error] && <p className="flag text-sm">{ERRORS[error]}</p>}

                <fieldset className="space-y-3">
                  <legend className="section-label mb-2">Client</legend>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="space-y-1 text-sm">
                      <span className="text-text-muted">First name</span>
                      <input name="first_name" required maxLength={80} autoComplete="off" className="input" />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-text-muted">Last name</span>
                      <input name="last_name" required maxLength={80} autoComplete="off" className="input" />
                    </label>
                  </div>
                  <label className="block space-y-1 text-sm">
                    <span className="text-text-muted">Phone</span>
                    <input name="phone" type="tel" required maxLength={40} autoComplete="off" className="input tabular-nums" />
                  </label>
                  <label className="block space-y-1 text-sm">
                    <span className="text-text-muted">Date of birth</span>
                    <input name="dob" type="date" required min="1900-01-01" className="input tabular-nums" />
                  </label>
                </fieldset>

                <fieldset className="space-y-3">
                  <legend className="section-label mb-2">Referred by</legend>
                  <label className="block space-y-1 text-sm">
                    <span className="text-text-muted">Your name</span>
                    <input name="referrer_name" required maxLength={120} autoComplete="name" className="input" />
                  </label>
                  <label className="block space-y-1 text-sm">
                    <span className="text-text-muted">Your department</span>
                    <input name="referrer_department" required maxLength={120} autoComplete="organization-title" className="input" />
                  </label>
                </fieldset>

                <p className="text-xs text-text-muted">
                  Please don&apos;t include Social Security numbers, ID numbers or medical details.
                </p>
                <button
                  type="submit"
                  className="w-full rounded-full bg-accent px-6 py-3 text-sm font-semibold text-bg hover:bg-accent-dim"
                >
                  Send referral
                </button>
              </form>
            )}
          </>
        )}
        <p className="text-center text-xs text-text-faint">
          <a href="/privacy" className="hover:underline">
            Privacy
          </a>
        </p>
      </main>
    </div>
  );
}
