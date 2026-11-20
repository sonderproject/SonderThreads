import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { query } from "@/lib/db/client";
import { canPost, loadMessages, markRead, messageCtx, readableConversation, teammates } from "@/lib/messages";
import { updateConversation } from "@/lib/actions/messages";
import { ChatView } from "@/components/messages/ChatView";

export const metadata = { title: "Messages · Surfdesk" };

export default async function ConversationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const ctx = await messageCtx();
  if (!ctx) redirect("/messages");
  const { id } = await params;
  const { saved } = await searchParams;
  const c = await readableConversation(ctx, id);
  if (!c) notFound();
  const [messages, members, team] = await Promise.all([
    loadMessages(ctx, c.id),
    c.kind === "channel"
      ? Promise.resolve([])
      : query<{ id: string; name: string }>(
          `select u.id, coalesce(u.name, u.email) as name
             from conversation_members cm join users u on u.id = cm.user_id
             join memberships m on m.user_id = cm.user_id and m.org_id = $2 and m.active
            where cm.conversation_id = $1 and cm.left_at is null
            order by coalesce(u.name, u.email)`,
          [c.id, ctx.orgId],
        ),
    c.kind === "group" ? teammates(ctx) : Promise.resolve([]),
  ]);
  await markRead(ctx, c.id);
  const others = members.filter((m) => m.id !== ctx.userId);
  const title =
    c.kind === "channel" ? `#${c.name}` : c.kind === "group" && c.name ? c.name : others.map((m) => m.name).join(", ") || "Just you";
  const privacy =
    c.kind === "channel"
      ? `Everyone in ${ctx.orgName} can read this channel.${c.post_policy === "managers" ? " Only Admins and Managers can post." : ""}`
      : "Private: only the people in this chat can read it. Admins can't read it.";
  const notIn = team.filter((t) => !members.some((m) => m.id === t.id));

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Link href="/messages" className="text-xs text-text-muted hover:text-accent">
          ← Messages
        </Link>
        <h1 className="page-title break-words">{title}</h1>
        <p className="text-xs text-text-muted">
          {privacy}
          {c.kind === "group" && members.length > 0 && <> In this chat: {members.map((m) => m.name).join(", ")}.</>}
        </p>
        {c.archived_at && <p className="text-xs text-danger">This channel is archived. Nobody can post in it.</p>}
        {saved && <p className="text-xs text-accent">Saved.</p>}
      </div>

      <ChatView
        conversationId={c.id}
        initial={messages}
        canPost={canPost(ctx, c)}
        canModerate={c.kind === "channel" && ctx.isManager}
        archived={Boolean(c.archived_at)}
        placeholder={c.kind === "channel" ? `Message #${c.name}` : "Write a message"}
      />

      {(c.kind === "channel" && ctx.isManager) || c.kind === "group" ? (
        <details className="card p-4 text-sm">
          <summary className="cursor-pointer text-text-muted">{c.kind === "channel" ? "Channel settings" : "Group settings"}</summary>
          <div className="mt-3 space-y-4">
            <form action={updateConversation} className="space-y-2">
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="intent" value="save" />
              {!c.is_general && <input name="name" defaultValue={c.name ?? ""} maxLength={60} placeholder="Name" className="input" />}
              {c.kind === "channel" && !c.is_general && (
                <fieldset className="space-y-1">
                  <legend className="eyebrow mb-1 text-text-faint">Who can post</legend>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="post_policy" value="everyone" defaultChecked={c.post_policy === "everyone"} /> Everyone
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="post_policy" value="managers" defaultChecked={c.post_policy === "managers"} /> Only Admins and Managers
                  </label>
                </fieldset>
              )}
              {c.is_general ? (
                <p className="text-xs text-text-muted">#general is your whole team&apos;s channel. Everyone can post, and it can&apos;t be archived.</p>
              ) : (
                <button className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-bg hover:bg-accent-dim">Save</button>
              )}
            </form>
            {c.kind === "group" && notIn.length > 0 && (
              <form action={updateConversation} className="space-y-1">
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="intent" value="add" />
                <p className="eyebrow text-text-faint">Add people</p>
                {notIn.map((t) => (
                  <label key={t.id} className="flex items-center gap-2">
                    <input type="checkbox" name="member" value={t.id} /> {t.name}
                  </label>
                ))}
                <p className="text-xs text-text-muted">People you add can read the whole chat, including earlier messages.</p>
                <button className="rounded-full border border-border px-4 py-1.5 text-sm hover:border-accent">Add</button>
              </form>
            )}
            {c.kind === "channel" && !c.is_general && (
              <form action={updateConversation}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="intent" value={c.archived_at ? "unarchive" : "archive"} />
                <button className="text-sm text-danger hover:underline">{c.archived_at ? "Unarchive channel" : "Archive channel"}</button>
              </form>
            )}
            {c.kind === "group" && (
              <form action={updateConversation}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="intent" value="leave" />
                <button className="text-sm text-danger hover:underline">Leave group</button>
              </form>
            )}
          </div>
        </details>
      ) : null}
    </div>
  );
}
