import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { List } from "@/lib/types";

export function ListCard({ list, itemCount }: { list: List; itemCount: number }) {
  return (
    <Link href={`/lists/${list.id}`}>
      <Card className="p-4 transition-colors hover:border-accent/50">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-text">{list.name}</p>
          {list.is_group && <Badge>group</Badge>}
        </div>
        {list.description && <p className="mt-1 text-sm text-text-muted">{list.description}</p>}
        <p className="mt-2 font-mono text-xs text-text-faint">
          {itemCount} item{itemCount === 1 ? "" : "s"}
        </p>
      </Card>
    </Link>
  );
}
