/** The text inside an organization type card: who it's for, then what's different about it. */
export function OrgKindText({ label, hint, features, current }: { label: string; hint: string; features: string[]; current?: boolean }) {
  return (
    <span className="block space-y-1.5">
      <span className="flex items-center gap-2">
        <span className="font-semibold text-text">{label}</span>
        {current && <span className="tag">Current</span>}
      </span>
      <span className="block text-xs text-text-muted">{hint}</span>
      <ul className="space-y-0.5 text-xs text-text">
        {features.map((f) => (
          <li key={f} className="flex gap-1.5">
            <span className="text-accent" aria-hidden>
              ✓
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </span>
  );
}
