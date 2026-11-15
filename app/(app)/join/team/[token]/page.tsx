import Link from "next/link";
import { queryOne } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { hashToken } from "@/lib/session";
import { getMembership, ROLE_HELP } from "@/lib/org";
import { joinWithTeamLink } from "@/lib/actions/team-invites";
import { emailDomain } from "@/lib/bulk-invite";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  invalid: "This team link isn't active. Ask your admin for the current one.",
  domain: "This link is for work email addresses only. Sign in with your work email, or ask your admin for an invite.",
  "other-org": "You're already in another organization. Ask that organization's admin to deactivate you first.",
  agree: "Please confirm the agreement to join.",
  seats: "This organization has no free seats right now. Ask your admin to add seats in Billing, then try again.",
};

/** Where a team join link lands (sign-in first; middleware handles that). Everyone joins as Member. */
export default async function TeamJoinPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const { error } = await searchParams;
  const userId = await requireUserId();
  const [org, me, membership] = await Promise.all([
    queryOne<{ id: string; name: string; domains: string[] | null }>(
      `select id, name, join_domains as domains from organizations where join_token_hash = $1 and suspended_at is null`,
      [hashToken(token)],
    ),
    queryOne<{ email: string }>(`select email from users where id = $1`, [userId]),
    getMembership(),
  ]);
  const problem =
    (error && error !== "agree" ? error : null) ??
    (!org
      ? "invalid"
      : !(org.domains ?? []).includes(emailDomain(me?.email ?? ""))
        ? "domain"
        : membership && membership.orgId !== org.id
          ? "other-org"
          : null);
  if (!problem && membership?.active && membership.orgId === org?.id) {
    return (
      <div className="max-w-md space-y-4">
        <h1 className="page-title">You&apos;re already in {org!.name}</h1>
        <Link href="/" className="text-sm text-accent hover:underline">
          Go to the app →
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md space-y-6">
      <h1 className="page-title">{org ? `Join ${org.name}` : "Team link"}</h1>
      {problem ? (
        <div className="card space-y-3 p-4">
          <p className="text-sm text-text">{ERRORS[problem] ?? ERRORS.invalid}</p>
          {problem === "domain" && org && (
            <p className="text-xs text-text-muted">
              You&apos;re signed in as {me?.email}. This link accepts {(org.domains ?? []).map((d) => `@${d}`).join(", ")} addresses.
            </p>
          )}
          <Link href="/" className="inline-block text-sm text-accent hover:underline">
            Go to the app →
          </Link>
        </div>
      ) : (
        <form action={joinWithTeamLink} className="card space-y-3 p-4">
          {error === "agree" && <p className="text-xs text-danger">{ERRORS.agree}</p>}
          <input type="hidden" name="token" value={token} />
          <p className="text-sm text-text">
            Join <strong>{org!.name}</strong> on Surfdesk as a <strong>Member</strong>. Your admin can change your role later.
          </p>
          <p className="text-xs text-text-muted">{ROLE_HELP.case_manager}</p>
          <p className="text-xs text-text-muted">
            Clients you add belong to {org!.name}. Your personal tasks, notes and lists stay private to you. Joining is free for you: the
            organization pays for your seat.
          </p>
          <label className="flex items-start gap-2 text-xs text-text-muted">
            <input type="checkbox" name="agree" required className="mt-0.5" />
            <span>
              I&apos;ll follow the{" "}
              <Link href="/terms" target="_blank" className="text-accent hover:underline">
                Terms of service
              </Link>
              , the{" "}
              <Link href="/privacy" target="_blank" className="text-accent hover:underline">
                Privacy policy
              </Link>{" "}
              and {org!.name}&apos;s rules when handling client information.
            </span>
          </label>
          <button type="submit" className="rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-bg hover:bg-accent-dim">
            Join {org!.name}
          </button>
        </form>
      )}
    </div>
  );
}
