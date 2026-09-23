export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded border border-border px-1.5 py-0.5 font-mono text-[11px] text-text-muted">
      {children}
    </span>
  );
}
