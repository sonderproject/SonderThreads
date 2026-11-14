import { BrandLockup } from "@/components/BrandLockup";
import { logout } from "@/app/login/actions";
import { ORG_STEPS, SOLO_STEPS } from "@/lib/setup";

/** The full-screen frame for each set-up step: brand, "Step 2 of 7", a progress bar, the step's title. */
export function SetupFrame({
  flow,
  step,
  title,
  intro,
  signedIn,
  children,
}: {
  /** After the account exists: offers "Sign out" so nobody is ever stuck in set-up. */
  signedIn?: boolean;
  flow: "org" | "solo";
  /** 1-based. */
  step: number;
  title: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-start justify-center bg-bg px-4 pb-16 pt-16 sm:pt-24">
      <div className="w-full max-w-lg space-y-6">
        <SetupProgress flow={flow} step={step} />
        <div className="space-y-1">
          <h1 className="page-title">{title}</h1>
          {intro && <p className="text-sm text-text-muted">{intro}</p>}
        </div>
        {children}
        {signedIn && (
          <form action={logout} className="border-t border-border-subtle pt-4 text-center">
            <p className="text-xs text-text-muted">
              Need to stop here? Your progress is saved.{" "}
              <button type="submit" className="text-accent hover:underline">
                Sign out
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

/** Brand plus "Step N of M · Name" and a bar. Also used on the sign-up and email-code pages. */
export function SetupProgress({ flow, step }: { flow: "org" | "solo"; step: number }) {
  const steps = flow === "org" ? ORG_STEPS : SOLO_STEPS;
  return (
    <div className="space-y-3">
      <BrandLockup />
      <div className="space-y-1.5">
        <p className="eyebrow text-text-faint">
          Step {step} of {steps.length} · {steps[step - 1]}
        </p>
        <div className="progress-bar" aria-hidden>
          <span style={{ width: `${Math.round((step / steps.length) * 100)}%` }} />
        </div>
      </div>
    </div>
  );
}
