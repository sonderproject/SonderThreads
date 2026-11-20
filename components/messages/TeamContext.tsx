"use client";

import { createContext, useContext } from "react";

/** Whether the signed-in person is in an organization (team messages and the Share buttons). */
const TeamContext = createContext({ inOrg: false });

export function TeamProvider({ inOrg, children }: { inOrg: boolean; children: React.ReactNode }) {
  return <TeamContext.Provider value={{ inOrg }}>{children}</TeamContext.Provider>;
}

export function useTeam() {
  return useContext(TeamContext);
}
