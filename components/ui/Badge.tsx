export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="tag bg-bg-hover text-text-muted">
      {children}
    </span>
  );
}
