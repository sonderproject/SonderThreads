/**
 * Strynd pricing: the single source of truth for what a plan costs. Pure (no
 * imports), so the server, the pricing page calculator and the tests all use
 * the same numbers. Amounts are integer cents.
 *
 *   Individual:            $9 / month (exactly 1 seat)
 *   Small Team (2–18):     $19 × seats
 *   Organization (19–20):  $349 (19 seats at $19 would be $361, so $349 applies)
 *   Organization (21+):    $349 + $15 for each seat over 20
 *   Enterprise:            custom, contact sales (no self-serve checkout)
 *
 * The live Stripe price for organizations ("strynd_org_monthly") is one
 * graduated price that charges exactly this: seats 1–18 at $19, a flat $7
 * when seats reach 19–20, then $15 a seat. orgPriceTiersMatch() checks the
 * live price against this formula before any checkout or seat change.
 */

export type AccountType = "individual" | "organization";

export const INDIVIDUAL_CENTS = 900;
export const SEAT_CENTS = 1900;
export const ORG_BASE_CENTS = 34900;
export const ORG_INCLUDED_SEATS = 20;
export const EXTRA_SEAT_CENTS = 1500;
/** Up to here it's Small Team pricing; from the next seat the $349 rate applies. */
export const SMALL_TEAM_MAX_SEATS = 18;
export const MIN_ORG_SEATS = 2;
/** Larger organizations talk to us (Enterprise). */
export const MAX_SELF_SERVE_SEATS = 500;

export function calculateMonthlyPriceCents(accountType: AccountType, seats: number): number {
  if (accountType === "individual") {
    if (seats !== 1) throw new Error("Individual plans require exactly one seat.");
    return INDIVIDUAL_CENTS;
  }
  if (!Number.isInteger(seats) || seats < MIN_ORG_SEATS) throw new Error("Organizations require at least two seats.");
  if (seats <= SMALL_TEAM_MAX_SEATS) return seats * SEAT_CENTS;
  if (seats <= ORG_INCLUDED_SEATS) return ORG_BASE_CENTS;
  return ORG_BASE_CENTS + (seats - ORG_INCLUDED_SEATS) * EXTRA_SEAT_CENTS;
}

/** Whole dollars, as in the spec. Payment math uses calculateMonthlyPriceCents. */
export function calculateMonthlyPrice(accountType: AccountType, seats: number): number {
  return calculateMonthlyPriceCents(accountType, seats) / 100;
}

/** Which tier a seat count lands in, for labels. */
export function orgTier(seats: number): "small_team" | "organization" {
  return seats <= SMALL_TEAM_MAX_SEATS ? "small_team" : "organization";
}

/** What $19 a seat would have cost, to show the savings once the $349 rate kicks in. */
export function perSeatCents(seats: number): number {
  return seats * SEAT_CENTS;
}

export function formatCents(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/** The graduated tiers to create the Stripe price with. */
export const ORG_PRICE_TIERS = [
  { up_to: SMALL_TEAM_MAX_SEATS, unit_amount: SEAT_CENTS },
  { up_to: ORG_INCLUDED_SEATS, flat_amount: ORG_BASE_CENTS - SMALL_TEAM_MAX_SEATS * SEAT_CENTS, unit_amount: 0 },
  { up_to: "inf" as const, unit_amount: EXTRA_SEAT_CENTS },
];

type Tier = { up_to: number | null | "inf"; unit_amount?: number | null; flat_amount?: number | null };

/** What a graduated price with these tiers charges for `qty` units (Stripe's rules). */
export function graduatedTotalCents(tiers: Tier[], qty: number): number {
  let total = 0;
  let prev = 0;
  for (const t of tiers) {
    const cap = t.up_to === null || t.up_to === "inf" ? Infinity : t.up_to;
    if (qty <= prev) break;
    const units = Math.min(qty, cap) - prev;
    if (units > 0) total += (t.flat_amount ?? 0) + units * (t.unit_amount ?? 0);
    prev = cap;
  }
  return total;
}

/** True when a Stripe price's tiers charge exactly calculateMonthlyPriceCents for every self-serve seat count. */
export function orgPriceTiersMatch(tiers: Tier[] | null | undefined): boolean {
  if (!tiers?.length) return false;
  for (let seats = MIN_ORG_SEATS; seats <= MAX_SELF_SERVE_SEATS; seats++) {
    if (graduatedTotalCents(tiers, seats) !== calculateMonthlyPriceCents("organization", seats)) return false;
  }
  return true;
}

/**
 * Seats in use after one more person: a new invite (+1, or 0 when it replaces
 * a pending invite for the same address), someone coming back (+1), or a
 * pending invite being accepted (0, it already holds a seat).
 */
export function seatsAfterAdding(
  active: number,
  pending: number,
  opts: { replacingInvite?: boolean; fromPendingInvite?: boolean } = {},
): number {
  if (opts.fromPendingInvite) return active + pending;
  return active + pending + 1 - (opts.replacingInvite ? 1 : 0);
}

/** The fewest seats an organization may have: 2, and never fewer than members plus pending invites. */
export function minimumSeats(active: number, pending: number): number {
  return Math.max(MIN_ORG_SEATS, active + pending);
}
