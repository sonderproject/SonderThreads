"use client";

import { createContext, useContext } from "react";

const TimeZoneContext = createContext<string | undefined>(undefined);

/** Shares the viewer's time zone (from the server's tz cookie) so server and browser render dates identically. */
export function TimeZoneProvider({ timeZone, children }: { timeZone: string; children: React.ReactNode }) {
  return <TimeZoneContext.Provider value={timeZone}>{children}</TimeZoneContext.Provider>;
}

export function useTimeZone(): string | undefined {
  return useContext(TimeZoneContext);
}
