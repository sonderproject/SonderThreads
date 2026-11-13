"use client";

import { createContext, useContext } from "react";
import { termsFor, type Audience, type Terms } from "@/lib/terms";

const TermsContext = createContext<Terms>(termsFor(false));

/** Nonprofit organizations see "Check-ins"/"Impact", business organizations "Visits"/"Insights", individuals "Meetings"/"Insights". */
export function TermsProvider({ audience, children }: { audience: Audience; children: React.ReactNode }) {
  return <TermsContext.Provider value={termsFor(audience)}>{children}</TermsContext.Provider>;
}

export function useTerms(): Terms {
  return useContext(TermsContext);
}
