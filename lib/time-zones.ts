/** US time zones offered for an organization (safe to import in the browser). */
export const US_ZONES = [
  ["America/Los_Angeles", "Pacific"],
  ["America/Denver", "Mountain"],
  ["America/Phoenix", "Arizona"],
  ["America/Chicago", "Central"],
  ["America/New_York", "Eastern"],
  ["America/Anchorage", "Alaska"],
  ["Pacific/Honolulu", "Hawaii"],
] as const;

export function zoneLabel(tz: string): string {
  return US_ZONES.find(([z]) => z === tz)?.[1] ?? tz;
}
