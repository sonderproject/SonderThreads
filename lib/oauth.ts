/**
 * Google and Apple sign-in through Supabase Auth (docs/auth-setup.md).
 * Each button shows only when its provider is switched on in Vercel
 * (AUTH_GOOGLE=on, AUTH_APPLE=on) after it's set up in Supabase → Auth → Providers.
 * Google and Apple verify the email address, so there's no confirmation email.
 */
export type OAuthProvider = "google" | "apple";

export function enabledProviders(): OAuthProvider[] {
  const on = (v: string | undefined) => v === "on" || v === "1" || v === "true";
  return [...(on(process.env.AUTH_GOOGLE) ? (["google"] as const) : []), ...(on(process.env.AUTH_APPLE) ? (["apple"] as const) : [])];
}

/** What the sign-up page knew (where they came from, setup flow, time zone), kept across the trip to Google/Apple. */
export const OAUTH_COOKIE = "sd_oauth";
export type OAuthContext = {
  next: string;
  utm: Record<string, string>;
  timeZone: string | null;
  /** The button was shown with the Terms notice next to it (it always is); recorded as the agreement for new accounts. */
  consent: boolean;
  /** Which page the button was on ("signup" or "login"), for the owner's funnel. */
  from: string;
};

export function parseContext(raw: string | undefined): OAuthContext | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as Partial<OAuthContext>;
    if (typeof c.next !== "string") return null;
    return {
      next: c.next,
      utm: typeof c.utm === "object" && c.utm ? Object.fromEntries(Object.entries(c.utm).filter(([k, v]) => /^utm_[a-z]+$/.test(k) && typeof v === "string").map(([k, v]) => [k, String(v).slice(0, 80)])) : {},
      timeZone: typeof c.timeZone === "string" ? c.timeZone.slice(0, 64) : null,
      consent: c.consent === true,
      from: c.from === "login" ? "login" : "signup",
    };
  } catch {
    return null;
  }
}
