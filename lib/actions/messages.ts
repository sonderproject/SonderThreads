"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { query, queryOne } from "@/lib/db/client";
import { notify } from "@/lib/notify";
import {
  MAX_BODY,
  canPost,
  cleanTags,
  loadMessages,
  markRead,
  messageCtx,
  readableConversation,
  readersOf,
  type ChatMessage,
  type Conversation,
  type MessageCtx,
  type Share,
} from "@/lib/messages";

async function ctxOrHome(): Promise<MessageCtx> {
  const ctx = await messageCtx();
  if (!ctx) redirect("/");
  return ctx;
}

function cleanName(raw: unknown, max = 60): string {
  return (raw?.toString() ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function channelSlug(raw: unknown): string {
  return (raw?.toString() ?? "")
    .toLowerCase()
    .replace(/^#/, "")
    .replace(/[^a-z0-9-_ ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40);
}

async function displayName(userId: string): Promise<string> {
  const r = await queryOne<{ n: string }>(`select coalesce(name, email) as n from users where id = $1`, [userId]);
  return r?.n ?? "A teammate";
}

/** Who gets told about a new message. Lock-screen alerts never include the message itself. */
async function alertReaders(ctx: MessageCtx, c: Conversation, messageId: string, mentionIds: string[]): Promise<void> {
  const from = await displayName(ctx.userId);
  const href = `/messages/${c.id}`;
  const where = c.kind === "channel" ? `#${c.name}` : c.kind === "group" ? (c.name ?? "a group chat") : null;
  const mentioned = new Set(mentionIds);
  for (const uid of mentioned) {
    await notify(uid, {
      type: "team_mention",
      title: `${from} mentioned you${where ? ` in ${where}` : ""}`,
      href,
      payload: { conversationId: c.id, messageId },
      channels: ["push"],
    }).catch((err) => console.error("[messages] mention alert failed", err));
  }
  // Direct and group chats: everyone else in the chat, once until they've caught up (no pile of alerts).
  if (c.kind === "channel") return;
  const readers = (await readersOf(c)).filter((u) => u !== ctx.userId && !mentioned.has(u));
  for (const uid of readers) {
    const waiting = await queryOne(
      `select 1 from notifications where user_id = $1 and type = 'team_message' and read_at is null and payload->>'conversationId' = $2`,
      [uid, c.id],
    );
    if (waiting) continue;
    await notify(uid, {
      type: "team_message",
      title: c.kind === "direct" ? `New message from ${from}` : `New message in ${where}`,
      href,
      payload: { conversationId: c.id },
      channels: ["push"],
    }).catch((err) => console.error("[messages] message alert failed", err));
  }
}

/** Client tags go in the organization's client activity log (who tagged which client, never the text). */
async function logClientTags(ctx: MessageCtx, messageId: string, personIds: string[]): Promise<void> {
  for (const pid of personIds) {
    await query(
      `insert into audit_log (org_id, actor_id, action, table_name, record_id, person_id) values ($1, $2, 'mention', 'messages', $3, $4)`,
      [ctx.orgId, ctx.userId, messageId, pid],
    ).catch((err) => console.error("[messages] audit failed", err));
  }
}

async function insertMessage(ctx: MessageCtx, c: Conversation, body: string, share: Share | null): Promise<string> {
  const tags = await cleanTags(ctx, c, body.slice(0, MAX_BODY));
  const row = await queryOne<{ id: string }>(
    `insert into messages (conversation_id, org_id, author_id, body, person_ids, mention_ids, share)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [c.id, ctx.orgId, ctx.userId, tags.body, tags.personIds, tags.mentionIds, share ? JSON.stringify(share) : null],
  );
  await query(`update conversations set last_message_at = now() where id = $1`, [c.id]);
  await markRead(ctx, c.id);
  // Logging and alerts finish after the reply, so sending stays quick in big groups.
  after(async () => {
    try {
      await logClientTags(ctx, row!.id, tags.personIds);
      await alertReaders(ctx, c, row!.id, tags.mentionIds);
    } catch (err) {
      console.error("[messages] after-send work failed", err);
    }
  });
  return row!.id;
}

export type SendResult = { ok: true; messages: ChatMessage[] } | { ok: false; error: string };

export async function sendMessage(conversationId: string, rawBody: string, since: string | null): Promise<SendResult> {
  const ctx = await messageCtx();
  if (!ctx) return { ok: false, error: "You're not in an organization." };
  const c = await readableConversation(ctx, conversationId);
  if (!c) return { ok: false, error: "This chat isn't available." };
  if (!canPost(ctx, c)) return { ok: false, error: c.archived_at ? "This channel is archived." : "Only Admins and Managers can post here." };
  const body = rawBody.trim();
  if (!body) return { ok: false, error: "Write a message first." };
  if (body.length > MAX_BODY) return { ok: false, error: `Keep it under ${MAX_BODY} characters.` };
  await insertMessage(ctx, c, body, null);
  return { ok: true, messages: await loadMessages(ctx, c.id, since) };
}

/** Polling while a chat is open: what changed since the last look. Also marks it read. */
export async function pollMessages(conversationId: string, since: string | null): Promise<ChatMessage[] | null> {
  const ctx = await messageCtx();
  if (!ctx) return null;
  const c = await readableConversation(ctx, conversationId);
  if (!c) return null;
  const msgs = await loadMessages(ctx, c.id, since);
  if (msgs.length) await markRead(ctx, c.id);
  return msgs;
}

export async function editMessage(messageId: string, rawBody: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await messageCtx();
  if (!ctx) return { ok: false, error: "You're not in an organization." };
  const m = await queryOne<{ conversation_id: string; author_id: string | null; deleted_at: string | null; share: unknown; person_ids: string[] }>(
    `select conversation_id, author_id, deleted_at, share, person_ids from messages where id = $1 and org_id = $2`,
    [messageId, ctx.orgId],
  );
  if (!m || m.author_id !== ctx.userId || m.deleted_at) return { ok: false, error: "You can only edit your own messages." };
  const c = await readableConversation(ctx, m.conversation_id);
  if (!c || c.archived_at) return { ok: false, error: "This chat isn't available." };
  const body = rawBody.trim();
  if (!body && !m.share) return { ok: false, error: "A message can't be empty. Delete it instead." };
  if (body.length > MAX_BODY) return { ok: false, error: `Keep it under ${MAX_BODY} characters.` };
  const tags = await cleanTags(ctx, c, body);
  await query(
    `update messages set body = $2, person_ids = $3, mention_ids = $4, edited_at = now(), updated_at = now() where id = $1`,
    [messageId, tags.body, tags.personIds, tags.mentionIds],
  );
  // Only clients newly tagged by this edit go in the activity log.
  const before = new Set(m.person_ids ?? []);
  await logClientTags(ctx, messageId, tags.personIds.filter((id) => !before.has(id)));
  return { ok: true };
}

/** Your own message, or (moderation) any message in a channel if you're an Admin or Manager. */
export async function deleteMessage(messageId: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await messageCtx();
  if (!ctx) return { ok: false, error: "You're not in an organization." };
  const m = await queryOne<{ conversation_id: string; author_id: string | null }>(
    `select conversation_id, author_id from messages where id = $1 and org_id = $2 and deleted_at is null`,
    [messageId, ctx.orgId],
  );
  if (!m) return { ok: false, error: "Message not found." };
  const c = await readableConversation(ctx, m.conversation_id);
  if (!c) return { ok: false, error: "This chat isn't available." };
  const allowed = m.author_id === ctx.userId || (c.kind === "channel" && ctx.isManager);
  if (!allowed) return { ok: false, error: "You can only delete your own messages." };
  await query(
    `update messages set body = '', person_ids = '{}', mention_ids = '{}', share = null, deleted_at = now(), updated_at = now() where id = $1`,
    [messageId],
  );
  return { ok: true };
}

/** Opens (or creates) the direct chat with one teammate. */
export async function startDirect(formData: FormData): Promise<void> {
  const ctx = await ctxOrHome();
  const other = formData.get("user_id")?.toString() ?? "";
  if (other === ctx.userId) redirect("/messages/new?error=self");
  const ok = await queryOne(`select 1 from memberships where org_id = $1 and user_id = $2 and active`, [ctx.orgId, other]);
  if (!ok) redirect("/messages/new?error=member");
  const existing = await queryOne<{ id: string }>(
    `select c.id from conversations c
      where c.org_id = $1 and c.kind = 'direct'
        and exists (select 1 from conversation_members where conversation_id = c.id and user_id = $2)
        and exists (select 1 from conversation_members where conversation_id = c.id and user_id = $3)`,
    [ctx.orgId, ctx.userId, other],
  );
  if (existing) redirect(`/messages/${existing.id}`);
  const c = await queryOne<{ id: string }>(
    `insert into conversations (org_id, kind, created_by) values ($1, 'direct', $2) returning id`,
    [ctx.orgId, ctx.userId],
  );
  await query(`insert into conversation_members (conversation_id, user_id) values ($1, $2), ($1, $3)`, [c!.id, ctx.userId, other]);
  redirect(`/messages/${c!.id}`);
}

/** Any member: a private group chat with chosen teammates. */
export async function createGroup(formData: FormData): Promise<void> {
  const ctx = await ctxOrHome();
  const name = cleanName(formData.get("name"));
  const picked = [...new Set(formData.getAll("member").map(String))].filter((id) => id !== ctx.userId).slice(0, 50);
  if (picked.length < 1) redirect("/messages/new?error=group");
  const valid = await query<{ user_id: string }>(
    `select user_id from memberships where org_id = $1 and active and user_id = any($2::uuid[])`,
    [ctx.orgId, picked],
  );
  if (!valid.length) redirect("/messages/new?error=group");
  const c = await queryOne<{ id: string }>(
    `insert into conversations (org_id, kind, name, created_by) values ($1, 'group', $2, $3) returning id`,
    [ctx.orgId, name || null, ctx.userId],
  );
  await query(
    `insert into conversation_members (conversation_id, user_id) select $1, unnest($2::uuid[]) on conflict do nothing`,
    [c!.id, [ctx.userId, ...valid.map((v) => v.user_id)]],
  );
  redirect(`/messages/${c!.id}`);
}

/** Admins and Managers: a channel every member can read. */
export async function createChannel(formData: FormData): Promise<void> {
  const ctx = await ctxOrHome();
  if (!ctx.isManager) redirect("/messages");
  const name = channelSlug(formData.get("name"));
  if (!name) redirect("/messages/new?error=channel");
  const policy = formData.get("post_policy") === "managers" ? "managers" : "everyone";
  const taken = await queryOne(
    `select 1 from conversations where org_id = $1 and kind = 'channel' and archived_at is null and lower(name) = $2`,
    [ctx.orgId, name],
  );
  if (taken) redirect("/messages/new?error=channel-taken");
  const c = await queryOne<{ id: string }>(
    `insert into conversations (org_id, kind, name, post_policy, created_by) values ($1, 'channel', $2, $3, $4) returning id`,
    [ctx.orgId, name, policy, ctx.userId],
  );
  redirect(`/messages/${c!.id}`);
}

/** Admins and Managers: rename a channel, change who can post, or archive it. Group chats: any member can rename. */
export async function updateConversation(formData: FormData): Promise<void> {
  const ctx = await ctxOrHome();
  const id = formData.get("id")?.toString() ?? "";
  const c = await readableConversation(ctx, id);
  if (!c) redirect("/messages");
  const intent = formData.get("intent")?.toString();
  if (c.kind === "channel") {
    if (!ctx.isManager) redirect(`/messages/${id}`);
    if (intent === "archive" && !c.is_general) {
      await query(`update conversations set archived_at = now() where id = $1`, [id]);
      redirect("/messages");
    }
    if (intent === "unarchive") await query(`update conversations set archived_at = null where id = $1`, [id]);
    if (intent === "save") {
      const name = c.is_general ? c.name : channelSlug(formData.get("name")) || c.name;
      const policy = c.is_general ? "everyone" : formData.get("post_policy") === "managers" ? "managers" : "everyone";
      await query(`update conversations set name = $2, post_policy = $3 where id = $1`, [id, name, policy]);
    }
  } else if (c.kind === "group" && intent === "save") {
    await query(`update conversations set name = $2 where id = $1`, [id, cleanName(formData.get("name")) || null]);
  } else if (c.kind === "group" && intent === "add") {
    const add = formData.getAll("member").map(String);
    await query(
      `insert into conversation_members (conversation_id, user_id)
       select $1, m.user_id from memberships m where m.org_id = $2 and m.active and m.user_id = any($3::uuid[])
       on conflict (conversation_id, user_id) do update set left_at = null`,
      [id, ctx.orgId, add],
    );
  } else if (c.kind === "group" && intent === "leave") {
    await query(`update conversation_members set left_at = now() where conversation_id = $1 and user_id = $2`, [id, ctx.userId]);
    redirect("/messages");
  }
  revalidatePath(`/messages/${id}`);
  redirect(`/messages/${id}?saved=1`);
}

/**
 * Admins only: delete a whole direct or group chat without opening it (they
 * never see its messages).
 */
export async function adminDeleteChat(formData: FormData): Promise<void> {
  const ctx = await ctxOrHome();
  if (ctx.role !== "admin") redirect("/messages");
  const id = formData.get("id")?.toString() ?? "";
  await query(`delete from conversations where id = $1 and org_id = $2 and kind in ('direct', 'group')`, [id, ctx.orgId]);
  revalidatePath("/messages/manage");
  redirect("/messages/manage?deleted=1");
}

export type ShareTarget = { id: string; title: string };

/** Chats and channels this member can post in (for the Share buttons). Null when not in an organization. */
export async function listShareTargets(): Promise<ShareTarget[] | null> {
  const ctx = await messageCtx();
  if (!ctx) return null;
  const { listConversations } = await import("@/lib/messages");
  const all = await listConversations(ctx);
  return all.filter((c) => c.kind !== "channel" || c.postPolicy === "everyone" || ctx.isManager).map((c) => ({ id: c.id, title: c.title }));
}

/** Shares a note into a chat. Client notes link to the client for readers who can see them; personal notes go as a copy. */
export async function shareNote(noteId: string, conversationId: string, comment: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await messageCtx();
  if (!ctx) return { ok: false, error: "You're not in an organization." };
  const c = await readableConversation(ctx, conversationId);
  if (!c || !canPost(ctx, c)) return { ok: false, error: "You can't post in that chat." };
  const note = await queryOne<{ id: string; content: string; person_id: string | null; org_id: string | null; display_name: string | null }>(
    `select n.id, n.content, n.person_id, n.org_id, p.display_name
       from notes n left join people p on p.id = n.person_id
      where n.id = $1 and n.deleted_at is null
        and (n.user_id = $2 or n.org_id in (select org_id from memberships where user_id = $2 and active))`,
    [noteId, ctx.userId],
  );
  if (!note) return { ok: false, error: "Note not found." };
  const orgNote = note.org_id === ctx.orgId && Boolean(note.person_id);
  const share: Share = {
    type: "note",
    noteId: note.id,
    excerpt: note.content.slice(0, 600),
    personId: orgNote ? note.person_id : null,
    personName: orgNote ? note.display_name : null,
    orgNote,
  };
  await insertMessage(ctx, c, comment.trim().slice(0, MAX_BODY), share);
  return { ok: true };
}

/** Shares a copy of one of your tasks (title and due date). The task itself stays private to you. */
export async function shareTask(taskId: string, conversationId: string, comment: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await messageCtx();
  if (!ctx) return { ok: false, error: "You're not in an organization." };
  const c = await readableConversation(ctx, conversationId);
  if (!c || !canPost(ctx, c)) return { ok: false, error: "You can't post in that chat." };
  const task = await queryOne<{ title: string; due_at: string | null }>(
    `select title, due_at from tasks where id = $1 and user_id = $2 and deleted_at is null`,
    [taskId, ctx.userId],
  );
  if (!task) return { ok: false, error: "Task not found." };
  await insertMessage(ctx, c, comment.trim().slice(0, MAX_BODY), { type: "task", title: task.title.slice(0, 300), due: task.due_at });
  return { ok: true };
}

import type { TagOption } from "@/lib/message-tags";

/** Autocomplete for # (the organization's clients) and @ (people who can read this chat). */
export async function searchTags(conversationId: string, kind: "client" | "user", q: string): Promise<TagOption[]> {
  const ctx = await messageCtx();
  if (!ctx) return [];
  const c = await readableConversation(ctx, conversationId);
  if (!c) return [];
  const term = `%${q.trim().replace(/[%_\\]/g, "").slice(0, 60)}%`;
  if (kind === "client") {
    const rows = await query<{ id: string; display_name: string }>(
      `select id, display_name from people where org_id = $1 and deleted_at is null and display_name ilike $2 order by display_name limit 8`,
      [ctx.orgId, term],
    );
    return rows.map((r) => ({ kind: "client", id: r.id, name: r.display_name }));
  }
  const readers = new Set(await readersOf(c));
  const rows = await query<{ id: string; name: string }>(
    `select u.id, coalesce(u.name, u.email) as name from memberships m join users u on u.id = m.user_id
      where m.org_id = $1 and m.active and m.user_id <> $2 and coalesce(u.name, u.email) ilike $3
      order by coalesce(u.name, u.email) limit 20`,
    [ctx.orgId, ctx.userId, term],
  );
  return rows.filter((r) => readers.has(r.id)).slice(0, 8).map((r) => ({ kind: "user", id: r.id, name: r.name }));
}
