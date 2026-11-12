/** Settings is a menu of sections, each on its own page (/settings/<slug>). */
export type SettingsSlug = "account" | "subscription" | "notifications" | "calendar" | "security" | "organization" | "data" | "about";

export const SETTINGS_SECTIONS: { slug: SettingsSlug; title: string; hint: string }[] = [
  { slug: "account", title: "Account", hint: "Your name, mobile number and email" },
  { slug: "subscription", title: "Subscription", hint: "Your plan, card, invoices and canceling" },
  { slug: "notifications", title: "Notifications", hint: "When and how Strynd reminds you" },
  { slug: "calendar", title: "Calendar", hint: "Link Google, Apple or Outlook, and see Strynd there" },
  { slug: "security", title: "Privacy & security", hint: "Password, two-step sign-in, auto-lock and devices" },
  { slug: "organization", title: "Organization", hint: "Your team, or set one up" },
  { slug: "data", title: "Your data", hint: "Import your client list, export, clear or delete your account" },
  { slug: "about", title: "About & help", hint: "Contact support, version and legal" },
];

export function isSettingsSlug(s: string): s is SettingsSlug {
  return SETTINGS_SECTIONS.some((x) => x.slug === s);
}

/** Old one-page anchors (/settings#billing) → the section that now holds them. */
export const HASH_TO_SECTION: Record<string, SettingsSlug> = {
  billing: "subscription",
  subscription: "subscription",
  account: "account",
  email: "account",
  notifications: "notifications",
  security: "security",
  "two-factor": "security",
  organization: "organization",
  data: "data",
  clear: "data",
  calendar: "calendar",
  about: "about",
  contact: "about",
  support: "about",
};

/**
 * Where a redirect like /settings?saved=profile belongs, so actions that
 * still send people to /settings land on the right section with their message.
 */
export function sectionForQuery(q: { error?: string; saved?: string; email?: string; billing?: string }): SettingsSlug | null {
  if (q.billing) return "subscription";
  if (q.saved === "notifications") return "notifications";
  if (q.saved === "security") return "security";
  if (q.saved === "cleared" || q.error === "clear-confirm") return "data";
  if (q.error === "confirm" || q.error === "delete-login" || q.error === "last-admin") return "data";
  if (q.saved === "profile" || q.email || q.error) return "account";
  return null;
}
