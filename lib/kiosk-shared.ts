/** Reason buttons on a new kiosk (staff can change them in kiosk setup). */
export const DEFAULT_KIOSK_REASONS = ["Appointment", "Drop-in", "Food pantry", "Mail pickup", "Other"];

/** Kiosk buttons from a services list: the first 11, plus "Other". */
export function kioskButtons(serviceNames: string[]): string[] {
  return [...serviceNames.slice(0, 11), "Other"];
}
