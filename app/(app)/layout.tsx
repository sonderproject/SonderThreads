import { AppShell } from "@/components/nav/AppShell";
import { checkSetup } from "@/lib/actions/diagnostics";
import { SetupIssuePanel } from "@/components/diagnostics/SetupIssuePanel";
import { listPeople } from "@/lib/actions/people";
import { listLists } from "@/lib/actions/lists";
import { getNotificationCount } from "@/lib/actions/notifications";

// This whole route group is a live, per-user dashboard — never prerender it.
export const dynamic = "force-dynamic";

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const diagnostic = await checkSetup();

  if (!diagnostic.ok) {
    return (
      <AppShell>
        <SetupIssuePanel diagnostic={diagnostic} />
      </AppShell>
    );
  }

  const [people, lists, notificationCount] = await Promise.all([listPeople(), listLists(), getNotificationCount()]);
  return (
    <AppShell
      people={people.map((p) => ({ id: p.id, display_name: p.display_name }))}
      lists={lists.map((l) => ({ id: l.id, name: l.name }))}
      notificationCount={notificationCount}
    >
      {children}
    </AppShell>
  );
}
