import Link from "next/link";
import { redirect } from "next/navigation";
import { getMembership } from "@/lib/org";
import { createOrganization } from "@/lib/actions/org";
import { ORG_KINDS, ORG_KINDS_SAME } from "@/lib/terms";
import { OrgKindText } from "@/components/org/OrgKindText";

/** Set up an organization (agency or team). The creator becomes its admin. */
export default async function NewOrganizationPage({ searchParams }: { searchParams: Promise<{ error?: string; offer?: string }> }) {
  if (await getMembership()) redirect("/organization");
  const { error, offer } = await searchParams;
  return (
    <div className="max-w-md space-y-6">
      <div className="space-y-1">
        <h1 className="page-title">Set up an organization</h1>
        <p className="text-sm text-text-muted">
          For nonprofits, agencies and businesses with a team: invite your staff, give managers a read-only view of every client, and keep each
          person&apos;s personal tasks and notes private.
        </p>
      </div>
      <form action={createOrganization} className="card space-y-3 p-4">
        {offer === "skip" && <input type="hidden" name="offer" value="skip" />}
        <label className="block space-y-1">
          <span className="text-xs text-text-muted">Organization name</span>
          <input name="name" required maxLength={200} placeholder="Hope House, or Pawsome Grooming" className="input" />
        </label>
        {error === "name" && <p className="text-xs text-danger">Enter a name.</p>}
        <fieldset className="space-y-1.5">
          <legend className="text-xs text-text-muted">What kind of organization?</legend>
          {ORG_KINDS.map((k, i) => (
            <label key={k.value} className="flex items-start gap-2 rounded-xl border border-border-subtle p-2.5 text-sm">
              <input type="radio" name="kind" value={k.value} defaultChecked={i === 0} required className="mt-1 accent-[var(--accent)]" />
              <OrgKindText {...k} />
            </label>
          ))}
          <p className="text-xs text-text-muted">{ORG_KINDS_SAME}</p>
        </fieldset>

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
            information in Surfdesk.
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
