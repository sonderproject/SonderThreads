import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandLockup } from "@/components/BrandLockup";
import { logout } from "@/app/login/actions";
import { getAuthState } from "@/lib/session";
import { getAppSettings } from "@/lib/app-settings";

export const metadata: Metadata = { title: "Back soon · Surfdesk", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Shown to everyone but the owner while maintenance mode is on (command center → Controls). Checks again every minute. */
export default async function MaintenancePage() {
  const state = await getAuthState();
  if (state.status !== "maintenance") redirect("/");
  const s = await getAppSettings();
  const until = s.maintenanceUntil
    ? s.maintenanceUntil.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles", timeZoneName: "short" })
    : null;
  return (
    <div className="flex min-h-screen items-start justify-center bg-bg px-4 pt-32 text-text">
      <meta httpEquiv="refresh" content="60" />
      <main className="w-full max-w-sm space-y-4">
        <BrandLockup className="mb-2" />
        <h1 className="page-title">Down for a quick update</h1>
        <p className="text-sm text-text-muted">
          {s.maintenanceMessage || "We're making Surfdesk better. Your data is safe and nothing is lost."}
          {until ? ` Back by ${until}.` : " Back shortly."}
        </p>
        <p className="text-xs text-text-faint">This page checks again every minute and opens the app as soon as it&apos;s back.</p>
        <form action={logout}>
          <button type="submit" className="text-sm text-text-muted hover:text-text">
            Sign out
          </button>
        </form>
      </main>
    </div>
  );
}
