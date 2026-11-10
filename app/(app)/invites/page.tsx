import Link from "next/link";
import { getPendingInvites } from "@/lib/org";
import { PendingInvites } from "@/components/org/PendingInvites";

/** Where an invite notification leads: the signed-in person's pending organization invites. */
export default async function InvitesPage({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const { invite: error } = await searchParams;
  const invites = await getPendingInvites();
  return (
    <div className="max-w-xl space-y-6">
      <h1 className="page-title">Invitations</h1>
      {invites.length === 0 && !error ? (
        <div className="card space-y-2 p-5 text-sm text-text-muted">
          <p>You have no pending invitations. They may have expired, or you already joined.</p>
          <Link href="/settings#organization" className="text-accent hover:underline">
            See your organization →
          </Link>
        </div>
      ) : (
        <PendingInvites invites={invites} error={error} />
      )}
    </div>
  );
}
