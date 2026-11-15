import type { Metadata } from "next";
import { requireOwner } from "@/lib/owner";
import { query } from "@/lib/db/client";
import { OwnerNav, when } from "@/components/owner/OwnerNav";
import { ROLE_LABELS } from "@/lib/org-roles";
import { ownerExtendTrial, ownerMakeFree, ownerResendFromAccounts, ownerSuspend, ownerUnsuspend } from "@/lib/actions/owner";

export const metadata: Metadata = { title: "Accounts · Command center", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const MESSAGES: Record<string, { text: string; ok: boolean }> = {
  suspended: { text: "Suspended. They see the suspended page until you lift it.", ok: true },
  unsuspended: { text: "Suspension lifted.", ok: true },
  extended: { text: "Trial extended.", ok: true },
  made_free: { text: "Now free for life.", ok: true },
  removed_free: { text: "Free for life removed. Normal billing rules apply again.", ok: true },
  resent: { text: "Confirmation email sent.", ok: true },
  owner: { text: "That's your own account (or an organization it's in). Owner controls never apply to it.", ok: false },
  days: { text: "Choose 1 to 60 days.", ok: false },
  already_free: { text: "That account is already free for life.", ok: false },
  not_trial: { text: "They already pay, so there's no trial to extend.", ok: false },
  no_card_yet: { text: "This organization hasn't started its trial (no card yet), so there's nothing to extend.", ok: false },
  has_subscription: { text: "They have a live Stripe subscription. Cancel it in Stripe first, then make them free.", ok: false },
  not_free: { text: "That account isn't free for life.", ok: false },
  resend_failed: { text: "Couldn't resend. Supabase allows one resend a minute per person.", ok: false },
  failed: { text: "That didn't work. Try again.", ok: false },
};

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
  confirmed: boolean;
  last_in: string | null;
  suspended_at: string | null;
  suspended_reason: string | null;
  org_name: string | null;
  role: string | null;
  plan: string | null;
  status: string | null;
  ends: string | null;
  trial_extra_days: number;
};
type OrgRow = {
  id: string;
  name: string;
  kind: string | null;
  created_at: string;
  members: number;
  pending: number;
  seats: number | null;
  plan: string | null;
  status: string | null;
  ends: string | null;
  last_in: string | null;
  suspended_at: string | null;
  suspended_reason: string | null;
  admins: string | null;
};

/** Search any account or organization; suspend, extend a trial, make free, resend the confirmation email. */
export default async function OwnerAccountsPage({ searchParams }: { searchParams: Promise<{ q?: string; msg?: string }> }) {
  await requireOwner();
  const { q = "", msg } = await searchParams;
  const term = q.trim().slice(0, 200);
  const like = `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const [users, orgs] = await Promise.all([
    query<UserRow>(
      `select u.id, u.email, u.name, u.created_at, au.email_confirmed_at is not null as confirmed, au.last_sign_in_at as last_in,
              u.suspended_at, u.suspended_reason, o.name as org_name, m.role, b.plan, b.status, b.current_period_end as ends, u.trial_extra_days
         from users u
         left join auth.users au on au.id = u.id
         left join memberships m on m.user_id = u.id and m.active
         left join organizations o on o.id = m.org_id
         left join billing_accounts b on b.user_id = u.id
        where ($1 = '' or u.email ilike $2 or u.name ilike $2)
        order by u.created_at desc limit 25`,
      [term, like],
    ),
    query<OrgRow>(
      `select o.id, o.name, o.kind, o.created_at, o.suspended_at, o.suspended_reason,
              (select count(*)::int from memberships m where m.org_id = o.id and m.active) as members,
              (select count(*)::int from invitations i where i.org_id = o.id and i.accepted_at is null and i.expires_at > now()) as pending,
              b.seats, b.plan, b.status, b.current_period_end as ends,
              (select max(au.last_sign_in_at) from memberships m join auth.users au on au.id = m.user_id where m.org_id = o.id) as last_in,
              (select string_agg(u.email, ', ') from memberships m join users u on u.id = m.user_id where m.org_id = o.id and m.active and m.role = 'admin') as admins
         from organizations o
         left join billing_accounts b on b.org_id = o.id
        where ($1 = '' or o.name ilike $2
               or exists (select 1 from memberships m join users u on u.id = m.user_id where m.org_id = o.id and u.email ilike $2))
        order by o.created_at desc limit 15`,
      [term, like],
    ),
  ]);
  const note = msg ? MESSAGES[msg] : null;

  return (
    <div className="max-w-3xl space-y-8">
      <OwnerNav active="/owner/accounts" title="Accounts" intro="Find any account or organization. Plans, seats and activity only, never client records." />

      <form className="flex gap-2" role="search">
        <input name="q" defaultValue={term} placeholder="Email, name or organization" className="input flex-1" autoComplete="off" spellCheck={false} />
        <button type="submit" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg hover:bg-accent-dim">
          Search
        </button>
      </form>
      {note && <p className={note.ok ? "text-sm text-accent" : "flag text-sm"}>{note.text}</p>}

      <section className="space-y-3">
        <h2 className="section-label">{term ? "Organizations" : "Newest organizations"}</h2>
        {orgs.length === 0 && <div className="card p-4 text-sm text-text-muted">None found.</div>}
        {orgs.map((o) => (
          <div key={o.id} className={`card space-y-3 p-4 ${o.suspended_at ? "flag-urgent" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text">{o.name}</p>
                <p className="text-xs text-text-muted">
                  {o.kind ?? "nonprofit"} · {o.members} {o.members === 1 ? "member" : "members"}
                  {o.pending ? ` + ${o.pending} invited` : ""} · {o.seats ?? "—"} seats · created {when(o.created_at)} · last active {when(o.last_in)}
                </p>
                {o.admins && <p className="truncate text-xs text-text-faint">Admins: {o.admins}</p>}
              </div>
              <PlanTags plan={o.plan} status={o.status} ends={o.ends} suspended={Boolean(o.suspended_at)} />
            </div>
            {o.suspended_at && <p className="text-xs text-text">Suspended {when(o.suspended_at)}{o.suspended_reason ? `: ${o.suspended_reason}` : ""}</p>}
            <Controls kind="org" id={o.id} q={term} suspended={Boolean(o.suspended_at)} free={o.plan === "comp"} />
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="section-label">{term ? "People" : "Newest accounts"}</h2>
        {users.length === 0 && <div className="card p-4 text-sm text-text-muted">None found.</div>}
        {users.map((u) => (
          <div key={u.id} className={`card space-y-3 p-4 ${u.suspended_at ? "flag-urgent" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text">{u.email}</p>
                <p className="text-xs text-text-muted">
                  {u.name ? `${u.name} · ` : ""}
                  {u.org_name ? `${ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ?? "Member"} at ${u.org_name}` : "Individual"} · signed up {when(u.created_at)} ·
                  last in {when(u.last_in)}
                  {u.trial_extra_days ? ` · +${u.trial_extra_days} trial days` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                {!u.confirmed && <span className="tag tag-u">Unconfirmed</span>}
                {!u.org_name && <PlanTags plan={u.plan} status={u.status} ends={u.ends} suspended={Boolean(u.suspended_at)} />}
                {u.org_name && u.suspended_at && <span className="tag tag-e">Suspended</span>}
              </div>
            </div>
            {u.suspended_at && <p className="text-xs text-text">Suspended {when(u.suspended_at)}{u.suspended_reason ? `: ${u.suspended_reason}` : ""}</p>}
            <Controls kind="user" id={u.id} q={term} suspended={Boolean(u.suspended_at)} free={u.plan === "comp"} individual={!u.org_name} />
            {!u.confirmed && (
              <form action={ownerResendFromAccounts}>
                <input type="hidden" name="email" value={u.email} />
                <input type="hidden" name="q" value={term} />
                <button type="submit" className="text-xs text-accent hover:underline">
                  Resend confirmation email
                </button>
              </form>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

function PlanTags({ plan, status, ends, suspended }: { plan: string | null; status: string | null; ends: string | null; suspended: boolean }) {
  return (
    <div className="flex flex-wrap gap-1">
      {suspended && <span className="tag tag-e">Suspended</span>}
      {plan === "comp" && <span className="tag tag-v">Free for life</span>}
      {plan !== "comp" && status === "active" && <span className="tag tag-v">Paying</span>}
      {status === "trialing" && (
        <span className="tag tag-n">Trial{ends ? ` to ${new Date(ends).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}</span>
      )}
      {(status === "past_due" || status === "unpaid") && <span className="tag tag-e">Past due</span>}
      {!status && <span className="tag tag-n">No card</span>}
      {status === "canceled" && <span className="tag tag-u">Canceled</span>}
    </div>
  );
}

const small = "rounded-full border border-border px-3 py-1 text-xs font-medium text-text hover:bg-bg-hover";

/** Suspend / lift, add trial days, free for life. Members of an organization are billed through it. */
function Controls({ kind, id, q, suspended, free, individual = true }: { kind: "user" | "org"; id: string; q: string; suspended: boolean; free: boolean; individual?: boolean }) {
  const hidden = (
    <>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="q" value={q} />
    </>
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      {suspended ? (
        <form action={ownerUnsuspend}>
          {hidden}
          <button type="submit" className={small}>
            Lift suspension
          </button>
        </form>
      ) : (
        <details className="group">
          <summary className={`${small} cursor-pointer list-none text-danger`}>Suspend…</summary>
          <form action={ownerSuspend} className="mt-2 flex flex-wrap gap-2">
            {hidden}
            <input name="reason" maxLength={500} placeholder="Reason they'll see (optional)" className="input min-w-0 flex-1 text-xs" />
            <button type="submit" className="rounded-full bg-danger px-3 py-1 text-xs font-semibold text-bg">
              Suspend {kind === "org" ? "organization" : "account"}
            </button>
          </form>
        </details>
      )}
      {individual && !free && (
        <form action={ownerExtendTrial} className="flex items-center gap-1">
          {hidden}
          <select name="days" defaultValue="7" className="input w-auto py-1 text-xs" aria-label="Days to add">
            {[3, 7, 14, 30].map((d) => (
              <option key={d} value={d}>
                +{d} days
              </option>
            ))}
          </select>
          <button type="submit" className={small}>
            Extend trial
          </button>
        </form>
      )}
      {individual && (
        <form action={ownerMakeFree}>
          {hidden}
          <input type="hidden" name="on" value={free ? "0" : "1"} />
          <button type="submit" className={small}>
            {free ? "Remove free for life" : "Make free for life"}
          </button>
        </form>
      )}
    </div>
  );
}
