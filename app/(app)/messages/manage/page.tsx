import Link from "next/link";
import { redirect } from "next/navigation";
import { query } from "@/lib/db/client";
import { messageCtx } from "@/lib/messages";
import { adminDeleteChat } from "@/lib/actions/messages";
import { ConfirmSubmit } from "@/components/ui/ConfirmSubmit";

export const metadata = { title: "Manage chats · Surfdesk" };

/**
 * Admins: every direct and group chat in the organization, by who's in it and
 * how many messages it has, so one can be deleted (say, after someone leaves).
 * Never the messages themselves: Admins can't read chats they're not in.
 */
export default async function ManageChatsPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const ctx = await messageCtx();
  if (!ctx || ctx.role !== "admin") redirect("/messages");
  const { deleted } = await searchParams;
  const chats = await query<{ id: string; kind: string; name: string | null; people: string[] | null; count: number; last: string }>(
    `select c.id, c.kind, c.name, c.last_message_at as last,
            (select array_agg(coalesce(u.name, u.email) order by coalesce(u.name, u.email))
               from conversation_members cm join users u on u.id = cm.user_id where cm.conversation_id = c.id and cm.left_at is null) as people,
            (select count(*)::int from messages m where m.conversation_id = c.id and m.deleted_at is null) as count
       from conversations c
      where c.org_id = $1 and c.kind in ('direct', 'group')
      order by c.last_message_at desc`,
    [ctx.orgId],
  );
  const archived = await query<{ id: string; name: string }>(
    `select id, name from conversations where org_id = $1 and kind = 'channel' and archived_at is not null order by name`,
    [ctx.orgId],
  );

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <Link href="/messages" className="text-xs text-text-muted hover:text-accent">
          ← Messages
        </Link>
        <h1 className="page-title">Manage chats</h1>
        <p className="text-sm text-text-muted">
          Private chats in {ctx.orgName}. You can delete a chat (for everyone in it), but you can&apos;t read it unless you&apos;re in it.
        </p>
        {deleted && <p className="text-xs text-accent">Chat deleted.</p>}
      </div>
      {chats.length === 0 ? (
        <p className="text-sm text-text-muted">No private chats yet.</p>
      ) : (
        <ul className="card divide-y divide-border p-1">
          {chats.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate">{c.kind === "group" && c.name ? `${c.name}: ` : ""}{(c.people ?? []).join(", ") || "Nobody left"}</p>
                <p className="text-xs text-text-muted">
                  {c.kind === "direct" ? "Direct" : "Group"} · {c.count} message{c.count === 1 ? "" : "s"} · last {new Date(c.last).toLocaleDateString()}
                </p>
              </div>
              <form action={adminDeleteChat}>
                <input type="hidden" name="id" value={c.id} />
                <ConfirmSubmit message="Delete this chat and all its messages for everyone in it? This can't be undone." className="text-xs text-danger hover:underline">
                  Delete
                </ConfirmSubmit>
              </form>
            </li>
          ))}
        </ul>
      )}
      {archived.length > 0 && (
        <section className="space-y-2">
          <h2 className="eyebrow text-text-faint">Archived channels</h2>
          <ul className="card divide-y divide-border p-1">
            {archived.map((a) => (
              <li key={a.id}>
                <Link href={`/messages/${a.id}`} className="block rounded-xl px-3 py-2.5 text-sm hover:bg-bg-hover">
                  #{a.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
