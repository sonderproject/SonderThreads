import type { Metadata } from "next";
import Link from "next/link";
import { requireOwner } from "@/lib/owner";
import { query } from "@/lib/db/client";
import { OwnerNav, when } from "@/components/owner/OwnerNav";
import { ownerResolveFeedback } from "@/lib/actions/owner";

export const metadata: Metadata = { title: "Inbox · Command center", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Message = { id: string; message: string; email: string | null; topic: string | null; created_at: string; resolved_at: string | null };

/** Messages from Settings → About & help (also emailed to support). Check them off when handled. */
export default async function OwnerInboxPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireOwner();
  const all = (await searchParams).show === "all";
  const [messages, open] = await Promise.all([
    query<Message>(
      `select id, message, email, meta->>'topic' as topic, created_at, resolved_at from app_events
        where kind = 'support.message' ${all ? "" : "and resolved_at is null"}
        order by created_at desc limit 100`,
    ),
    query<{ n: number }>(`select count(*)::int as n from app_events where kind = 'support.message' and resolved_at is null`),
  ]);
  const openCount = open[0]?.n ?? 0;

  return (
    <div className="max-w-3xl space-y-6">
      <OwnerNav active="/owner/inbox" title="Inbox" intro="Feedback and support messages from inside the app. Reply by email; check them off here." />
      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="text-text-muted">
          {openCount} open {openCount === 1 ? "message" : "messages"}
        </p>
        <Link href={all ? "/owner/inbox" : "/owner/inbox?show=all"} className="text-accent hover:underline">
          {all ? "Show open only" : "Show done too"}
        </Link>
      </div>
      {messages.length === 0 && <div className="card p-4 text-sm text-text-muted">{all ? "No messages yet." : "All caught up."}</div>}
      <div className="space-y-3">
        {messages.map((m) => {
          // Stored as "Topic: message" (lib/actions/support.ts).
          const body = m.topic && m.message.startsWith(`${m.topic}: `) ? m.message.slice(m.topic.length + 2) : m.message;
          return (
            <div key={m.id} className={`card space-y-2 p-4 ${m.resolved_at ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-center gap-2">
                {m.topic && <span className={`tag ${m.topic.startsWith("Something isn") ? "tag-e" : m.topic.startsWith("An idea") ? "tag-n" : "tag-u"}`}>{m.topic}</span>}
                <span className="text-xs text-text-muted">{when(m.created_at)}</span>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm text-text">{body}</p>
              <div className="flex flex-wrap items-center justify-between gap-2">
                {m.email ? (
                  <a href={`mailto:${m.email}?subject=${encodeURIComponent("Re: your Surfdesk message")}`} className="text-xs text-accent hover:underline">
                    Reply to {m.email}
                  </a>
                ) : (
                  <span />
                )}
                <form action={ownerResolveFeedback}>
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="done" value={m.resolved_at ? "0" : "1"} />
                  {all && <input type="hidden" name="show" value="all" />}
                  <button type="submit" className="rounded-full border border-border px-3 py-1 text-xs font-medium text-text hover:bg-bg-hover">
                    {m.resolved_at ? "Reopen" : "Mark done"}
                  </button>
                </form>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
