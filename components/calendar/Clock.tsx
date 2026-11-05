"use client";

import { useEffect, useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");

/** Live local clock. Renders nothing until mounted so server and browser time zones can't mismatch. */
export function Clock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="card flex min-h-36 flex-col items-center justify-center px-5 py-4 text-center">
      {now && (
        <>
          <p className="eyebrow text-text-faint">
            {now.toLocaleDateString(undefined, { weekday: "long" })}
          </p>
          <p className="mt-1 font-display text-5xl font-semibold leading-none tabular-nums text-text">
            {now.getHours() % 12 || 12}:{pad(now.getMinutes())}
            <span className="ml-1.5 font-sans text-lg font-semibold text-text-muted">
              {now.getHours() < 12 ? "AM" : "PM"}
            </span>
          </p>
          <p className="mt-2 text-sm text-text-muted">
            {now.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </>
      )}
    </div>
  );
}
