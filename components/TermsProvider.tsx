"use client";

import { createContext, useContext } from "react";
import { termsFor, type Terms } from "@/lib/terms";

const TermsContext = createContext<Terms>(termsFor(false));

/** Organization members see "Check-ins"/"Impact"; everyone else "Meetings"/"Insights". */
export function TermsProvider({ isOrg, children }: { isOrg: boolean; children: React.ReactNode }) {
  return <TermsContext.Provider value={termsFor(isOrg)}>{children}</TermsContext.Provider>;
}

export function useTerms(): Terms {
  return useContext(TermsContext);
}
