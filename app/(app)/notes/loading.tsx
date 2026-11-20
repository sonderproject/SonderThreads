/** Notes-shaped placeholder shown instantly while notes load, so the page doesn't sit blank. */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading notes" className="space-y-4">
      <h1 className="page-title">Notes</h1>
      <div className="card h-[132px] animate-pulse" />
      <div className="h-[42px] animate-pulse rounded-xl bg-bg-raised" />
      <div className="grid gap-2 sm:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="card h-24 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
