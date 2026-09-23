import { EmptyState } from "@/components/ui/EmptyState";
import type { Activity } from "@/lib/types";

export function ClientTimeline({ activity }: { activity: Activity[] }) {
  if (activity.length === 0) {
    return <EmptyState message="No activity yet." />;
  }

  return (
    <div className="space-y-3">
      {activity.map((item) => (
        <div key={item.id} className="flex gap-4">
          <span className="w-16 shrink-0 font-mono text-xs text-text-faint">
            {new Date(item.created_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </span>
          <p className="text-sm text-text-muted">{item.description}</p>
        </div>
      ))}
    </div>
  );
}
