/** Shown instantly while a page's data loads, so taps feel immediate. */
export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-9 w-40 animate-pulse rounded bg-bg-hover" />
      <div className="h-24 animate-pulse rounded border border-border bg-bg-raised" />
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded border border-border bg-bg-raised" />
        ))}
      </div>
    </div>
  );
}
