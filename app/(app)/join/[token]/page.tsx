import Link from "next/link";
import { queryOne } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { hashToken } from "@/lib/session";
import { getMembership, ROLE_HELP, ROLE_LABELS, type OrgRole } from "@/lib/org";
import { acceptInvite } from "@/lib/actions/org";

const ERRORS: Record<string, string> = {
  invalid: "This invite link isn't valid. Ask your admin for a new one.",
  used: "This invite has already been used.",
  expired: "This invite has expired. Ask your admin for a new one.",
  email: "This invite is for a different email address. Sign in with the address it was sent to.",
  "other-org": "You're already in another organization. Ask that organization's admin to deactivate you first.",
};

/** Where an invite link lands (sign-in is required first; middleware handles that). */
export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const userId = await requireUserId();
  const [invite, me, membership] = await Promise.all([
    queryOne<{ org_name: string; email: string; role: OrgRole; expired: boolean; accepted: boolean }>(
      `select o.name as org_name, i.email, i.role, i.expires_at < now() as expired, i.accepted_at is not null as accepted
         from invitations i join organizations o on o.id = i.org_id where i.token_hash = $1`,
      [hashToken(token)],
    ),
    queryOne<{ email: string }>(`select email from users where id = $1`, [userId]),
    getMembership(),
  ]);

  const problem =
    error ??
    (!invite ? "invalid" : invite.accepted ? "used" : invite.expired ? "expired" : me?.email.toLowerCase() !== invite.email.toLowerCase() ? "email" : null);

  return (
    <div className="max-w-md space-y-6">
      <h1 className="page-title">{invite ? `Join ${invite.org_name}` : "Invite"}</h1>
      {problem ? (
        <div className="card space-y-3 p-4">
          <p className="text-sm text-text">{ERRORS[problem] ?? ERRORS.invalid}</p>
          {problem === "email" && invite && (
            <p className="text-xs text-text-muted">
              You&apos;re signed in as {me?.email}; the invite is for {invite.email}.
            </p>
          )}
          <Link href="/" className="inline-block text-sm text-accent hover:underline">
            Go to the app →
          </Link>
        </div>
      ) : (
        <form action={acceptInvite} className="card space-y-3 p-4">
          <input type="hidden" name="token" value={token} />
          <p className="text-sm text-text">
            You&apos;re invited to join <strong>{invite!.org_name}</strong> as a <strong>{ROLE_LABELS[invite!.role]}</strong>.
          </p>
          <p className="text-xs text-text-muted">{ROLE_HELP[invite!.role]}</p>
          <p className="text-xs text-text-muted">
            Clients you add (and any existing ones you choose next) belong to {invite!.org_name}. Your personal tasks, notes
            and lists stay private to you.
          </p>
          {membership && <p className="text-xs text-text-muted">You&apos;re currently in {membership.orgName}.</p>}
          <button type="submit" className="rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-bg hover:bg-accent-dim">
            Join {invite!.org_name}
          </button>
        </form>
      )}
    </div>
  );
}
