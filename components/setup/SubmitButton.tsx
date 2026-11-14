"use client";

import { useFormStatus } from "react-dom";

/** A form's submit button that shows it's working ("Saving…") and can't be pressed twice. */
export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  className,
  name,
  value,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending, data } = useFormStatus();
  // With two submit buttons (e.g. trial or 30% off), only the one pressed says it's working.
  const mine = !name || data?.get(name) === value;
  return (
    <button type="submit" name={name} value={value} disabled={pending} aria-busy={pending && mine} className={`${className ?? ""} disabled:opacity-60`}>
      {pending && mine ? pendingLabel : children}
    </button>
  );
}
