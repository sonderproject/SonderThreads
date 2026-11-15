import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLockup } from "@/components/BrandLockup";
import { logout } from "@/app/login/actions";
import { getAuthState } from "@/lib/session";
import { SUPPORT_EMAIL } from "@/lib/settings-options";

export const metadata: Metadata = { title: "Account suspended · Surfdesk", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Shown instead of the app to an account the owner suspended (or a member of a suspended organization). */
export default async function SuspendedPage() {
  const state = await getAuthState();
  if (state.status === "signed-out") redirect("/login");
  if (state.status !== "suspended") redirect("/");
  return (
    <div className="flex min-h-screen items-start justify-center bg-bg px-4 pt-32 text-text">
      <main className="w-full max-w-sm space-y-4">
        <BrandLockup className="mb-2" />
        <h1 className="page-title">This account is suspended</h1>
        <p className="text-sm text-text-muted">
          You can&apos;t use Surfdesk with {state.email} right now. If you think this is a mistake, email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent hover:underline">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
        {state.reason && <p className="flag text-sm">{state.reason}</p>}
        <div className="flex items-center gap-4 pt-2 text-sm">
          <form action={logout}>
            <button type="submit" className="rounded-full border border-border px-4 py-2 font-medium hover:bg-bg-hover">
              Sign out
            </button>
          </form>
          <Link href="/terms" className="text-text-muted hover:text-text">
            Terms
          </Link>
          <Link href="/privacy" className="text-text-muted hover:text-text">
            Privacy
          </Link>
        </div>
      </main>
    </div>
  );
}
