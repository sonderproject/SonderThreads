/**
 * Words that depend on who's using Surfdesk:
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
  /** Exits: leaving a program (nonprofit) or no longer a customer/client (business, individual). */
  exitAction: string; // "Exit from program" | "Mark as former customer" | "Mark as former client"
  exitedLabel: string; // "Exited" | "Former customer" | "Former client"
  reopenAction: string; // "Re-enroll" | "Mark as active again"
  exitWhy: string; // "Where did they exit to?" | "Why did they leave?"
};

/** `true`/`false` are the older "is an organization member" form (an organization counts as a nonprofit). */
export function termsFor(audience: Audience | boolean): Terms {
  const a: Audience = audience === true ? "nonprofit" : audience === false ? "individual" : audience;
  if (a === "nonprofit")
    return { audience: a, checkIns: "Check-ins", checkIn: "Check-in", checkInsLower: "check-ins", checkInLower: "check-in", logCheckIn: "Log a check-in", impact: "Impact", exitAction: "Exit from program", exitedLabel: "Exited", reopenAction: "Re-enroll", exitWhy: "Where did they exit to?" };
  if (a === "business")
    return { audience: a, checkIns: "Visits", checkIn: "Visit", checkInsLower: "visits", checkInLower: "visit", logCheckIn: "Log a visit", impact: "Insights", exitAction: "Mark as former customer", exitedLabel: "Former customer", reopenAction: "Mark as active again", exitWhy: "Why did they leave?" };
  return { audience: a, checkIns: "Meetings", checkIn: "Meeting", checkInsLower: "meetings", checkInLower: "meeting", logCheckIn: "Log a meeting", impact: "Insights", exitAction: "Mark as former client", exitedLabel: "Former client", reopenAction: "Mark as active again", exitWhy: "Why did they leave?" };
}

export type OrgKind = "nonprofit" | "business";
/** The organization type cards (set-up, Organization page): who each is for and what changes. */
export const ORG_KINDS: { value: OrgKind; label: string; hint: string; features: string[] }[] = [
  {
    value: "nonprofit",
    label: "Nonprofit or agency",
    hint: "Programs, case management, community and social services.",
    features: [
      "Staff log check-ins with clients",
      "Impact report: people served, new vs returning, busiest times",
      "Includes demographics for funders and your board",
    ],
  },
  {
    value: "business",
    label: "Business",
    hint: "Salons, groomers, vets, studios, coaching: any business with regular customers.",
    features: [
      "Staff log visits with customers",
      "Insights report: customers served, new vs repeat, busiest times",
      "Shows revenue from your service prices; no demographics",
    ],
  },
];
/** Shown under the type cards. */
export const ORG_KINDS_SAME = "Everything else is the same for both: clients, tasks, notes, team roles, kiosk, referrals and exports.";
export function isOrgKind(v: unknown): v is OrgKind {
  return v === "nonprofit" || v === "business";
}
