import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/current-user";
import { getMembership } from "@/lib/org";
import { finishOrgSetup } from "@/lib/actions/setup";
import { SetupFrame } from "@/components/setup/SetupFrame";

export const metadata = { title: "Your clients · Surfdesk" };
export const dynamic = "force-dynamic";

/** Organization set-up, step 7 of 7 (last): upload clients from a spreadsheet, or start using the app. */
export default async function SetupClientsPage({ searchParams }: { searchParams: Promise<{ invited?: string }> }) {
  await requireUserId();
  const m = await getMembership();
  if (!m?.active || m.role !== "admin") redirect("/");
  const { invited } = await searchParams;
  return (
    <SetupFrame
      flow="org"
      step={7}
      signedIn
      title="Bring in your clients"
      intro="Upload your client list from Excel or a CSV file (name, phone, email and notes columns are picked up automatically), or add them as you go."
    >
      {invited && Number(invited) > 0 && (
        <p className="text-sm text-accent">
          {invited} {Number(invited) === 1 ? "invite" : "invites"} sent.
        </p>
      )}
      <form action={finishOrgSetup} className="grid gap-3 sm:grid-cols-2">
        <button name="go" value="import" className="card space-y-1 p-5 text-left transition-colors hover:bg-bg-hover">
          <span className="block font-semibold text-text">Upload a spreadsheet</span>
          <span className="block text-xs text-text-muted">Excel or CSV. Takes about a minute.</span>
        </button>
        <button name="go" value="app" className="card space-y-1 p-5 text-left transition-colors hover:bg-bg-hover">
          <span className="block font-semibold text-text">I&apos;ll add them as I go</span>
          <span className="block text-xs text-text-muted">Go to your team dashboard.</span>
        </button>
      </form>
      <p className="text-xs text-text-muted">
        Already using Surfdesk on your own? You can move your existing clients in from{" "}
        <Link href="/organization/clients" className="text-accent hover:underline">
          Organization → Bring in your clients
        </Link>{" "}
        later.
      </p>
    </SetupFrame>
  );
}
