"use client";

import { useEffect, useState } from "react";

/** Sends this browser's UTC offset (minutes) with a form, so a datetime-local time means the owner's local time. */
export function TimeZoneOffset() {
  const [offset, setOffset] = useState("0");
  useEffect(() => setOffset(String(new Date().getTimezoneOffset())), []);
  return <input type="hidden" name="tz_offset" value={offset} />;
}
