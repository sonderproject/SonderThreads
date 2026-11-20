import { query, queryOne } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { getMembership } from "@/lib/org";
import type { OrgRole } from "@/lib/org-roles";
import { TOKEN_RE, editTextOf, parseBody, previewOf, tagIds, type Segment } from "@/lib/message-tags";

/**
 * Team messages: chats between active members of the same organization.
 *
 * - Channels (kind 'channel'): every active member can read. Posting is
 *   everyone, or Admins and Managers only (post_policy 'managers'). Admins and
 *   Managers create, rename and archive them. Each organization has a #general
 *   channel that can't be archived.
 * - Direct and group chats: only the people in conversation_members (and still
 *   active in the organization) can read them. Admins can't open a chat they
 *   aren't in; they can only delete one (Messages → Manage chats).
 * - Tags live in the body as <#person-id> (a client) and <@user-id> (a
 *   teammate). Names are filled in per reader: only the organization's own
 *   clients can be tagged, and anyone who can't see a client gets "a client".
 * - Tasks stay private: sharing a task posts a copy (title and due date), never the task.
 */

export type MessageCtx = { userId: string; orgId: string; orgName: string; role: OrgRole; isManager: boolean };

export type ConversationKind = "direct" | "group" | "channel";
export type Conversation = {
  id: string;
  org_id: string;
  kind: ConversationKind;
  name: string | null;
  post_policy: "everyone" | "managers";
  is_general: boolean;
  created_by: string | null;
  last_message_at: string;
  archived_at: string | null;
};

export type { Segment } from "@/lib/message-tags";

export type Share =
  | { type: "note"; excerpt: string; personId: string | null; personName: string | null; noteId: string; orgNote: boolean }
  | { type: "task"; title: string; due: string | null };

export type ChatMessage = {
  id: string;
  authorId: string | null;
  authorName: string;
  mine: boolean;
  segments: Segment[];
  /** The body as typed (tokens turned back into "@Name"/"#Name"), for editing. */
  editText: string;
  share: Share | null;
  createdAt: string;
  updatedAt: string;
  edited: boolean;
  deleted: boolean;
};

export { TOKEN_RE };
export const MAX_BODY = 4000;

/** A timestamp column as exact ISO text (microseconds, UTC): sorts as text and round-trips for polling. */
const iso = (col: string) => `to_char(${col} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

/** The signed-in member's context, or null when they're not active in an organization. */
export async function messageCtx(): Promise<MessageCtx | null> {
  const [userId, m] = await Promise.all([requireUserId(), getMembership()]);
  if (!m?.active) return null;
  return { userId, orgId: m.orgId, orgName: m.orgName, role: m.role, isManager: m.role === "admin" || m.role === "supervisor" };
}

/** Every organization has a #general channel everyone can post in. */
export async function ensureGeneral(ctx: MessageCtx): Promise<void> {
  await query(
    `insert into conversations (org_id, kind, name, post_policy, is_general, created_by)
     values ($1, 'channel', 'general', 'everyone', true, $2)
     on conflict (org_id) where is_general do nothing`,
    [ctx.orgId, ctx.userId],
  );
}

/** The conversation if this member may read it (channel in their organization, or a chat they're in). */
export async function readableConversation(ctx: MessageCtx, id: string): Promise<Conversation | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return queryOne<Conversation>(
    `select c.* from conversations c
      where c.id = $1 and c.org_id = $2
        and (c.kind = 'channel'
             or exists (select 1 from conversation_members cm where cm.conversation_id = c.id and cm.user_id = $3 and cm.left_at is null))`,
    [id, ctx.orgId, ctx.userId],
  );
}

export function canPost(ctx: MessageCtx, c: Conversation): boolean {
  if (c.archived_at) return false;
  return c.kind !== "channel" || c.post_policy === "everyone" || ctx.isManager;
}

export type ConversationSummary = {
  id: string;
  kind: ConversationKind;
  title: string;
  isGeneral: boolean;
  postPolicy: "everyone" | "managers";
  lastAt: string;
  preview: string | null;
  unread: number;
  members: number;
};

/** The member's channels and chats, newest activity first, with unread counts. */
export async function listConversations(ctx: MessageCtx): Promise<ConversationSummary[]> {
  await ensureGeneral(ctx);
  const rows = await query<{
    id: string;
    kind: ConversationKind;
    name: string | null;
    is_general: boolean;
    post_policy: "everyone" | "managers";
    last_message_at: string;
    preview: string | null;
    preview_deleted: boolean | null;
    preview_share: string | null;
    unread: number;
    member_names: string[] | null;
    members: number;
  }>(
    `with mine as (
       select c.* from conversations c
        where c.org_id = $1 and c.archived_at is null
          and (c.kind = 'channel'
               or exists (select 1 from conversation_members cm where cm.conversation_id = c.id and cm.user_id = $2 and cm.left_at is null))
     )
     select c.id, c.kind, c.name, c.is_general, c.post_policy, ${iso("c.last_message_at")} as last_message_at,
            last.body as preview, last.deleted_at is not null as preview_deleted, last.share->>'type' as preview_share,
            (select count(*)::int from messages m
              where m.conversation_id = c.id and m.deleted_at is null and m.author_id is distinct from $2
                and m.created_at > coalesce((select last_read_at from conversation_members r where r.conversation_id = c.id and r.user_id = $2),
                                            (select created_at from memberships where user_id = $2 and org_id = $1))) as unread,
            case when c.kind = 'channel' then null else
              (select array_agg(coalesce(u.name, u.email) order by coalesce(u.name, u.email))
                 from conversation_members cm join users u on u.id = cm.user_id
                 join memberships ms on ms.user_id = cm.user_id and ms.org_id = $1 and ms.active
                where cm.conversation_id = c.id and cm.left_at is null and cm.user_id <> $2) end as member_names,
            case when c.kind = 'channel' then (select count(*)::int from memberships where org_id = $1 and active)
                 else (select count(*)::int from conversation_members cm where cm.conversation_id = c.id and cm.left_at is null) end as members
       from mine c
       left join lateral (
         select body, deleted_at, share from messages m where m.conversation_id = c.id order by created_at desc limit 1
       ) last on true
      order by c.is_general desc, c.last_message_at desc`,
    [ctx.orgId, ctx.userId],
  );
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    title:
      r.kind === "channel"
        ? `#${r.name ?? "channel"}`
        : r.kind === "group" && r.name
          ? r.name
          : r.member_names?.length
            ? r.member_names.join(", ")
            : "Just you",
    isGeneral: r.is_general,
    postPolicy: r.post_policy,
    lastAt: r.last_message_at,
    preview: r.preview_deleted
      ? "Message deleted"
      : r.preview
        ? previewOf(r.preview)
        : r.preview_share
          ? `Shared a ${r.preview_share}`
          : null,
    unread: r.unread,
    members: r.members,
  }));
}

/** Total unread across all of the member's chats and channels (nav badge). */
export async function unreadMessageCount(ctx: MessageCtx): Promise<number> {
  const row = await queryOne<{ n: number }>(
    `select count(*)::int as n
       from messages m join conversations c on c.id = m.conversation_id
      where c.org_id = $1 and c.archived_at is null and m.deleted_at is null and m.author_id is distinct from $2
        and (c.kind = 'channel'
             or exists (select 1 from conversation_members cm where cm.conversation_id = c.id and cm.user_id = $2 and cm.left_at is null))
        and m.created_at > coalesce((select last_read_at from conversation_members r where r.conversation_id = c.id and r.user_id = $2),
                                    (select created_at from memberships where user_id = $2 and org_id = $1))`,
    [ctx.orgId, ctx.userId],
  );
  return row?.n ?? 0;
}

/** Everyone in the conversation who can read it (for notifications). */
export async function readersOf(c: Conversation): Promise<string[]> {
  const rows =
    c.kind === "channel"
      ? await query<{ user_id: string }>(`select user_id from memberships where org_id = $1 and active`, [c.org_id])
      : await query<{ user_id: string }>(
          `select cm.user_id from conversation_members cm
             join memberships m on m.user_id = cm.user_id and m.org_id = $2 and m.active
            where cm.conversation_id = $1 and cm.left_at is null`,
          [c.id, c.org_id],
        );
  return rows.map((r) => r.user_id);
}

/**
 * Checks the tags in a body: clients must belong to the organization (they're
 * visible to every member), teammates must be active members who can read this
 * conversation. Anything else is turned back into plain text.
 */
export async function cleanTags(ctx: MessageCtx, c: Conversation, body: string): Promise<{ body: string; personIds: string[]; mentionIds: string[] }> {
  const { clients: clientIds, users: userIds } = tagIds(body);
  const okClients = clientIds.size
    ? new Set(
        (
          await query<{ id: string }>(`select id from people where id = any($1::uuid[]) and org_id = $2 and deleted_at is null`, [
            [...clientIds],
            ctx.orgId,
          ])
        ).map((r) => r.id),
      )
    : new Set<string>();
  const readers = userIds.size ? new Set(await readersOf(c)) : new Set<string>();
  const okUsers = new Set([...userIds].filter((id) => readers.has(id)));
  const cleaned = body.replace(TOKEN_RE, (whole, k: string, id: string) => {
    const lower = id.toLowerCase();
    if (k === "#") return okClients.has(lower) ? `<#${lower}>` : "a client";
    return okUsers.has(lower) ? `<@${lower}>` : "@teammate";
  });
  return { body: cleaned, personIds: [...okClients], mentionIds: [...okUsers].filter((id) => id !== ctx.userId) };
}

type Row = {
  id: string;
  author_id: string | null;
  author_name: string | null;
  body: string;
  share: Share | null;
  created_at: string;
  updated_at: string;
  edited_at: string | null;
  deleted_at: string | null;
};

/** Messages for one reader, with tags filled in for them. `since` = only changed after (for polling). */
export async function loadMessages(ctx: MessageCtx, conversationId: string, since?: string | null): Promise<ChatMessage[]> {
  const rows = since
    ? await query<Row>(
        `select m.id, m.author_id, coalesce(u.name, u.email) as author_name, m.body, m.share, ${iso("m.created_at")} as created_at, ${iso("m.updated_at")} as updated_at, m.edited_at, m.deleted_at
           from messages m left join users u on u.id = m.author_id
          where m.conversation_id = $1 and m.updated_at > $2::timestamptz
          order by m.created_at asc limit 200`,
        [conversationId, since],
      )
    : (
        await query<Row>(
          `select m.id, m.author_id, coalesce(u.name, u.email) as author_name, m.body, m.share, ${iso("m.created_at")} as created_at, ${iso("m.updated_at")} as updated_at, m.edited_at, m.deleted_at
             from messages m left join users u on u.id = m.author_id
            where m.conversation_id = $1
            order by m.created_at desc limit 150`,
          [conversationId],
        )
      ).reverse();
  return renderMessages(ctx, rows);
}

async function renderMessages(ctx: MessageCtx, rows: Row[]): Promise<ChatMessage[]> {
  const clientIds = new Set<string>();
  const userIds = new Set<string>();
  for (const r of rows) {
    const ids = tagIds(r.body);
    ids.clients.forEach((id) => clientIds.add(id));
    ids.users.forEach((id) => userIds.add(id));
  }
  // Names only for clients this reader can see right now (their organization's, or their own).
  const clients = clientIds.size
    ? new Map(
        (
          await query<{ id: string; display_name: string }>(
            `select id, display_name from people
              where id = any($1::uuid[]) and deleted_at is null
                and (user_id = $2 or org_id in (select org_id from memberships where user_id = $2 and active))`,
            [[...clientIds], ctx.userId],
          )
        ).map((r) => [r.id, r.display_name]),
      )
    : new Map<string, string>();
  const users = userIds.size
    ? new Map(
        (await query<{ id: string; name: string }>(`select id, coalesce(name, email) as name from users where id = any($1::uuid[])`, [[...userIds]])).map(
          (r) => [r.id, r.name],
        ),
      )
    : new Map<string, string>();
  return rows.map((r) => {
    const segments: Segment[] = r.deleted_at ? [] : parseBody(r.body, clients, users);
    const editText = editTextOf(segments);
    let share = r.deleted_at ? null : r.share;
    // A client note shared into a chat: only show which client to readers who can see that client.
    if (share?.type === "note" && share.personId && !clients.has(share.personId)) {
      share = { ...share, personName: null };
    }
    return {
      id: r.id,
      authorId: r.author_id,
      authorName: r.author_name ?? "Former member",
      mine: r.author_id === ctx.userId,
      segments,
      editText,
      share,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      edited: Boolean(r.edited_at),
      deleted: Boolean(r.deleted_at),
    };
  });
}

/** Marks a conversation read for this member (adds a read marker row for channels). */
export async function markRead(ctx: MessageCtx, conversationId: string): Promise<void> {
  await query(
    `insert into conversation_members (conversation_id, user_id, last_read_at) values ($1, $2, now())
     on conflict (conversation_id, user_id) do update set last_read_at = now()`,
    [conversationId, ctx.userId],
  );
  // Opening the chat clears its alerts on the Notifications page too.
  await query(
    `update notifications set read_at = now()
      where user_id = $1 and read_at is null and type in ('team_message', 'team_mention') and payload->>'conversationId' = $2`,
    [ctx.userId, conversationId],
  );
}

/** Active teammates (for new chats and @mentions). */
export async function teammates(ctx: MessageCtx): Promise<{ id: string; name: string; role: OrgRole }[]> {
  return query<{ id: string; name: string; role: OrgRole }>(
    `select u.id, coalesce(u.name, u.email) as name, m.role
       from memberships m join users u on u.id = m.user_id
      where m.org_id = $1 and m.active
      order by coalesce(u.name, u.email)`,
    [ctx.orgId],
  );
}
