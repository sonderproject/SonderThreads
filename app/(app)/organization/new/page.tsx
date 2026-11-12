import Link from "next/link";
import { redirect } from "next/navigation";
import { getMembership } from "@/lib/org";
import { createOrganization } from "@/lib/actions/org";

/** Set up an organization (agency or team). The creator becomes its admin. */
export default async function NewOrganizationPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getMembership()) redirect("/organization");
  const { error } = await searchParams;
  return (
    <div className="max-w-md space-y-6">
      <div className="space-y-1">
        <h1 className="page-title">Set up an organization</h1>
        <p className="text-sm text-text-muted">
          For agencies and teams: invite your staff, give managers a read-only view of every client, and keep each
          person&apos;s personal tasks and notes private.
        </p>
      </div>
      <form action={createOrganization} className="card space-y-3 p-4">
        <label className="block space-y-1">
          <span className="text-xs text-text-muted">Organization name</span>
          <input name="name" required maxLength={200} placeholder="Hope House" className="input" />
        </label>
        {error === "name" && <p className="text-xs text-danger">Enter a name.</p>}
        {error === "agree" && (
          <p className="text-xs text-danger">Please confirm the agreement below to create the organization.</p>
        )}
        <p className="text-xs text-text-muted">
          You&apos;ll be its admin. Next you&apos;ll start your 14-day free trial ($0 today, card required, one trial per
          card), then choose which of your existing clients to bring in; anything you don&apos;t choose stays private to you.
        </p>
        <label className="flex items-start gap-2 text-xs text-text-muted">
          <input type="checkbox" name="agree" required className="mt-0.5" />
          <span>
            I&apos;m authorized to agree to the{" "}
            <Link href="/terms" target="_blank" className="text-accent hover:underline">
              Terms of service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" target="_blank" className="text-accent hover:underline">
              Privacy policy
            </Link>{" "}
            for this organization, and it has its clients&apos; permission (or another lawful basis) to keep their
            information in Strynd.
          </span>
        </label>
        <div className="flex gap-2">
          <button type="submit" className="rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-bg hover:bg-accent-dim">
            Create organization
          </button>
          <Link href="/settings" className="rounded-full border border-border px-3 py-1.5 text-sm font-medium text-text hover:bg-bg-hover">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
