"use client";

import { useMemo, useState } from "react";
import { ClientCard } from "@/components/clients/ClientCard";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Client } from "@/lib/types";

export function ClientsBrowser({ clients }: { clients: Client[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      [c.display_name, c.current_status, c.next_action, c.summary]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q)),
    );
  }, [clients, query]);

  return (
    <div className="space-y-4">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search clients..."
        className="input font-mono"
      />

      {filtered.length === 0 ? (
        <EmptyState message={clients.length === 0 ? "No clients yet." : "No matches."} />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {filtered.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </div>
      )}
    </div>
  );
}
