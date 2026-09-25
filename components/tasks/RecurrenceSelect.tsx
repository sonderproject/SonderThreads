import { RECURRENCE_OPTIONS } from "@/lib/recurrence";
import type { TaskRecurrence } from "@/lib/types";

export function RecurrenceSelect({
  value,
  onChange,
  className = "input",
}: {
  value: TaskRecurrence | "";
  onChange: (value: TaskRecurrence | "") => void;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as TaskRecurrence | "")}
      className={className}
      aria-label="Repeat"
    >
      <option value="">Doesn&apos;t repeat</option>
      {RECURRENCE_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
