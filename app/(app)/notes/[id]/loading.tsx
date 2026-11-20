/** Shown instantly while a note opens. */
export default function Loading() {
  return (
    <div role="status" aria-label="Opening note" className="mx-auto max-w-3xl space-y-3">
      <div className="h-9" />
      <div className="h-8 w-48 animate-pulse rounded-full bg-bg-raised" />
      <div className="h-10 animate-pulse rounded-full bg-bg-raised" />
      <div className="card min-h-[60vh] animate-pulse" />
    </div>
  );
}
