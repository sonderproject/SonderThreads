/**
 * Words that depend on who's using Strynd:
 *   Nonprofit or agency organization: Check-ins, Impact
 *   Business organization:            Visits,    Insights
 *   Individual (no organization):     Meetings,  Insights
 */
export type Audience = "individual" | "nonprofit" | "business";

export type Terms = {
  audience: Audience;
  checkIns: string; // "Check-ins" | "Visits" | "Meetings"
  checkIn: string; // "Check-in" | "Visit" | "Meeting"
  checkInsLower: string;
  checkInLower: string;
  logCheckIn: string; // "Log a check-in" | "Log a visit" | "Log a meeting"
  impact: string; // "Impact" | "Insights"
};

/** `true`/`false` are the older "is an organization member" form (an organization counts as a nonprofit). */
export function termsFor(audience: Audience | boolean): Terms {
  const a: Audience = audience === true ? "nonprofit" : audience === false ? "individual" : audience;
  if (a === "nonprofit")
    return { audience: a, checkIns: "Check-ins", checkIn: "Check-in", checkInsLower: "check-ins", checkInLower: "check-in", logCheckIn: "Log a check-in", impact: "Impact" };
  if (a === "business")
    return { audience: a, checkIns: "Visits", checkIn: "Visit", checkInsLower: "visits", checkInLower: "visit", logCheckIn: "Log a visit", impact: "Insights" };
  return { audience: a, checkIns: "Meetings", checkIn: "Meeting", checkInsLower: "meetings", checkInLower: "meeting", logCheckIn: "Log a meeting", impact: "Insights" };
}

export type OrgKind = "nonprofit" | "business";
export const ORG_KINDS: { value: OrgKind; label: string; hint: string }[] = [
  { value: "nonprofit", label: "Nonprofit or agency", hint: "Programs, case management, community services. Words: check-ins, Impact reports." },
  { value: "business", label: "Business", hint: "Salons, groomers, vets, studios, coaching, any business with regulars. Words: visits, Insights reports." },
];
export function isOrgKind(v: unknown): v is OrgKind {
  return v === "nonprofit" || v === "business";
}
