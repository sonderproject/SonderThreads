/** Shown right away while a page in the app is loading (slow connections). */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="flex min-h-[40vh] items-center justify-center">
      <div className="page-spinner" />
    </div>
  );
}
