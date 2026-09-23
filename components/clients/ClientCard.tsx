import Link from "next/link";
import { Card } from "@/components/ui/Card";
import type { Client } from "@/lib/types";

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "1h ago" : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? "1w ago" : `${weeks}w ago`;
}

export function ClientCard({ client }: { client: Client }) {
  return (
    <Link href={`/clients/${client.id}`}>
      <Card className="p-4 transition-colors hover:border-accent/50">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-text">{client.display_name}</p>
          <span className="shrink-0 font-mono text-[11px] text-text-faint">
            {relativeTime(client.last_activity_at)}
          </span>
        </div>
        {client.current_status && (
          <p className="mt-1 text-sm text-text-muted">{client.current_status}</p>
        )}
        {client.next_action && (
          <p className="mt-1 text-xs text-accent">→ {client.next_action}</p>
        )}
      </Card>
    </Link>
  );
}
