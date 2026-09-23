export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded border border-dashed border-border px-4 py-8 text-center text-sm text-text-faint">
      {message}
    </div>
  );
}
