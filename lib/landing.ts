/**
 * The three audience landing pages (/individuals, /business, /nonprofits).
 * Their CTAs carry campaign tags so sign-ups, trials and paid conversions per page
 * show in the owner command center (Growth: sign-ups by campaign). Tags from an ad
 * link win: CampaignLinks overwrites these when the visitor arrived with their own.
 */
export type LandingKey = "individuals" | "business" | "nonprofits" | "home";

export const LANDING_LINKS: { key: LandingKey; path: string; label: string }[] = [
  { key: "individuals", path: "/individuals", label: "Surfdesk for individuals" },
  { key: "business", path: "/business", label: "Surfdesk for business" },
  { key: "nonprofits", path: "/nonprofits", label: "Surfdesk for nonprofits" },
];

/** A sign-up link tagged with the landing page it came from. */
export function landingHref(path: string, page: LandingKey): string {
  const [base, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set("utm_source", "surfdesk");
  params.set("utm_medium", "landing");
  params.set("utm_campaign", page);
  return `${base}?${params.toString()}`;
}
