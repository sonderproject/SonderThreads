import Link from "next/link";
import { redirect } from "next/navigation";
import { messageCtx, teammates } from "@/lib/messages";
import { createChannel, createGroup, startDirect } from "@/lib/actions/messages";
import { ROLE_LABELS } from "@/lib/org-roles";

export const metadata = { title: "New message · Surfdesk" };

const ERRORS: Record<string, string> = {
  self: "Pick a teammate other than yourself.",
  member: "That person isn't an active member of your organization.",
  group: "Pick at least one teammate for the group.",
  channel: "Give the channel a name (letters, numbers and dashes).",
  "channel-taken": "There's already a channel with that name.",
};

export default async function NewMessagePage({ searchParams }: { searchParams: Promise<{ type?: string; error?: string }> }) {
  const ctx = await messageCtx();
  if (!ctx) redirect("/messages");
  const { type, error } = await searchParams;
  const people = (await teammates(ctx)).filter((p) => p.id !== ctx.userId);
  const tab = type === "group" || (type === "channel" && ctx.isManager) ? type : "direct";
  const tabs = [
    { id: "direct", label: "Direct message" },
    { id: "group", label: "Group chat" },
    ...(ctx.isManager ? [{ id: "channel", label: "Channel" }] : []),
  ];

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <Link href="/messages" className="text-xs text-text-muted hover:text-accent">
          ← Messages
        </Link>
        <h1 className="page-title">New message</h1>
      </div>
      <div className="flex flex-wrap gap-1">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={`/messages/new?type=${t.id}`}
            className={`rounded-full px-3 py-1.5 text-sm ${tab === t.id ? "bg-accent-soft font-medium text-accent" : "text-text-muted hover:bg-bg-hover hover:text-text"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>
      {error && <p className="text-sm text-danger">{ERRORS[error] ?? "Something went wrong."}</p>}

      {people.length === 0 && tab !== "channel" ? (
        <p className="text-sm text-text-muted">
          Nobody else is on your team yet. Invite teammates from{" "}
          <Link href="/team" className="text-accent hover:underline">
            Team
          </Link>
          .
        </p>
      ) : tab === "direct" ? (
        <ul className="card divide-y divide-border p-1">
          {people.map((p) => (
            <li key={p.id}>
              <form action={startDirect}>
                <input type="hidden" name="user_id" value={p.id} />
                <button className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm hover:bg-bg-hover">
                  <span>{p.name}</span>
                  <span className="text-xs text-text-faint">{ROLE_LABELS[p.role]}</span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : tab === "group" ? (
        <form action={createGroup} className="card space-y-3 p-4">
          <input name="name" maxLength={60} placeholder="Group name (optional)" className="input" />
          <fieldset className="space-y-1">
            <legend className="eyebrow mb-1 text-text-faint">Who&apos;s in it</legend>
            {people.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="member" value={p.id} />
                {p.name} <span className="text-xs text-text-faint">{ROLE_LABELS[p.role]}</span>
              </label>
            ))}
          </fieldset>
          <p className="text-xs text-text-muted">Private: only the people you add can read it. Admins can&apos;t read it.</p>
          <button className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-bg hover:bg-accent-dim">Start group chat</button>
        </form>
      ) : (
        <form action={createChannel} className="card space-y-3 p-4">
          <input name="name" required maxLength={40} placeholder="Channel name, e.g. front-desk" className="input" />
          <fieldset className="space-y-1 text-sm">
            <legend className="eyebrow mb-1 text-text-faint">Who can post</legend>
            <label className="flex items-center gap-2">
              <input type="radio" name="post_policy" value="everyone" defaultChecked /> Everyone
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="post_policy" value="managers" /> Only Admins and Managers (announcements)
            </label>
          </fieldset>
          <p className="text-xs text-text-muted">Everyone in {ctx.orgName} can read every channel.</p>
          <button className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-bg hover:bg-accent-dim">Create channel</button>
        </form>
      )}
    </div>
  );
}
