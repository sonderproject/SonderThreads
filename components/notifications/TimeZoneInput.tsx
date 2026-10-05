"use client";

import { useEffect, useState } from "react";

/** Sends the browser's time zone with a form, so reminders arrive at the right local time. */
export function TimeZoneInput() {
  const [tz, setTz] = useState("");
  useEffect(() => setTz(Intl.DateTimeFormat().resolvedOptions().timeZone ?? ""), []);
  return <input type="hidden" name="timezone" value={tz} />;
}
