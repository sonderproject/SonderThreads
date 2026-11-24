/**
 * The app's navigation, decided in one place for the top bar and the phone menu.
 * Individuals get a short personal organizer bar; Business accounts get the same core
 * plus a Workspace menu with their client and team tools (lib/plan.ts).
 */
export type NavItem = { href: string; label: string; badge?: number; also?: string[] };

export type NavInput = {
  business: boolean;
  /** Members (case managers) in an organization don't get Insights. */
  showImpact: boolean;
  showTeam: boolean;
  messageCount: number | null;
  referralCount: number | null;
  showOwner: boolean;
  terms: { checkIns: string; impact: string };
};

export function navModel(n: NavInput): { primary: NavItem[]; menu: { label: string; items: NavItem[]; badge: number } } {
  const insights: NavItem[] = n.showImpact ? [{ href: "/impact", label: n.terms.impact, also: n.business ? ["/reports"] : [] }] : [];
  const primary: NavItem[] = [
    { href: "/", label: "Home" },
    { href: "/people", label: "People" },
    { href: "/tasks", label: "Tasks" },
    { href: "/calendar", label: "Calendar" },
    { href: "/notes", label: "Notes" },
    ...insights,
  ];
  const owner: NavItem[] = n.showOwner ? [{ href: "/owner", label: "Command center" }] : [];
  if (!n.business) {
    return { primary, menu: { label: "More", items: [{ href: "/lists", label: "Lists" }, { href: "/check-ins", label: n.terms.checkIns }, ...owner], badge: 0 } };
  }
  const items: NavItem[] = [
    { href: "/check-ins", label: n.terms.checkIns },
    { href: "/lists", label: "Lists" },
    { href: "/forms", label: "Forms" },
    { href: "/automations", label: "Automations" },
    ...(n.messageCount !== null ? [{ href: "/messages", label: "Messages", badge: n.messageCount }] : []),
    ...(n.referralCount !== null ? [{ href: "/referrals", label: "Referrals", badge: n.referralCount }] : []),
    ...(n.showTeam ? [{ href: "/team", label: "Team" }] : []),
    ...owner,
  ];
  return { primary, menu: { label: "Workspace", items, badge: items.reduce((s, i) => s + (i.badge ?? 0), 0) } };
}

export function isActive(pathname: string, item: Pick<NavItem, "href" | "also">): boolean {
  const hit = (h: string) => (h === "/" ? pathname === "/" : pathname === h || pathname.startsWith(`${h}/`) || pathname.startsWith(`${h}?`));
  return hit(item.href) || (item.also ?? []).some(hit);
}
