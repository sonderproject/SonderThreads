import Link from "next/link";
import { listConversations, messageCtx } from "@/lib/messages";
import { RefreshOnShow } from "@/components/ui/RefreshOnShow";

export const metadata = { title: "Messages · Surfdesk" };

function when(iso: string): string {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

/** Team messages: the organization's channels, plus this member's direct and group chats. */
export default async function MessagesPage() {
  const ctx = await messageCtx();
  if (!ctx) {
    return (
      <div className="space-y-2">
        <h1 className="page-title">Messages</h1>
        <p className="text-sm text-text-muted">
          Messages are for teams. Create or join an organization in{" "}
          <Link href="/settings" className="text-accent hover:underline">
            Settings
          </Link>{" "}
          to chat with your teammates.
        </p>
      </div>
    );
  }
  const all = await listConversations(ctx);
  const channels = all.filter((c) => c.kind === "channel");
  const chats = all.filter((c) => c.kind !== "channel");

  const Row = ({ c }: { c: (typeof all)[number] }) => (
    <li>
      <Link href={`/messages/${c.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-bg-hover">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`truncate text-sm ${c.unread ? "font-semibold text-text" : "text-text"}`}>{c.title}</span>
            {c.kind === "channel" && c.postPolicy === "managers" && <span className="tag">Announcements</span>}
          </div>
          {c.preview && <p className="truncate text-xs text-text-muted">{c.preview}</p>}
        </div>
        <span className="shrink-0 text-xs tabular-nums text-text-faint">{when(c.lastAt)}</span>
        {c.unread > 0 && (
          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold tabular-nums text-bg">
            {c.unread > 99 ? "99+" : c.unread}
          </span>
        )}
      </Link>
    </li>
  );

  return (
    <div className="space-y-6">
      <RefreshOnShow />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="eyebrow text-text-faint">{ctx.orgName}</p>
          <h1 className="page-title">Messages</h1>
        </div>
        <Link href="/messages/new" className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-bg hover:bg-accent-dim">
          New message
        </Link>
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="eyebrow text-text-faint">Channels</h2>
          {ctx.isManager && (
            <Link href="/messages/new?type=channel" className="text-xs text-accent hover:underline">
              New channel
            </Link>
          )}
        </div>
        <ul className="card divide-y divide-border p-1">
          {channels.map((c) => (
            <Row key={c.id} c={c} />
          ))}
        </ul>
        <p className="text-xs text-text-muted">Everyone in {ctx.orgName} can read channels.</p>
      </section>

      <section className="space-y-2">
        <h2 className="eyebrow text-text-faint">Direct and group chats</h2>
        {chats.length ? (
          <ul className="card divide-y divide-border p-1">
            {chats.map((c) => (
              <Row key={c.id} c={c} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">No chats yet. Start one with New message.</p>
        )}
        <p className="text-xs text-text-muted">
          Private: only the people in a chat can read it. Admins can&apos;t read chats they&apos;re not in.
        </p>
      </section>

      {ctx.role === "admin" && (
        <Link href="/messages/manage" className="inline-block text-xs text-text-muted hover:text-accent hover:underline">
          Manage chats (Admins)
        </Link>
      )}
    </div>
  );
}
