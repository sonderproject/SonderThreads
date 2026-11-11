/**
 * Words that depend on who's using Strynd. Organizations (agencies, teams)
 * keep their working terms; everyone else sees plain ones.
 *   Organization: Check-ins, Impact
 *   Individual:   Meetings,  Insights
 */
export type Terms = {
  checkIns: string; // "Check-ins" | "Meetings"
  checkIn: string; // "Check-in" | "Meeting"
  checkInsLower: string; // "check-ins" | "meetings"
  checkInLower: string; // "check-in" | "meeting"
  logCheckIn: string; // "Log a check-in" | "Log a meeting"
  impact: string; // "Impact" | "Insights"
};

export function termsFor(isOrg: boolean): Terms {
  return isOrg
    ? { checkIns: "Check-ins", checkIn: "Check-in", checkInsLower: "check-ins", checkInLower: "check-in", logCheckIn: "Log a check-in", impact: "Impact" }
    : { checkIns: "Meetings", checkIn: "Meeting", checkInsLower: "meetings", checkInLower: "meeting", logCheckIn: "Log a meeting", impact: "Insights" };
}
