import { unstable_rethrow } from "next/navigation";
import { AppShell } from "@/components/nav/AppShell";
import { TimeZoneProvider } from "@/components/TimeZoneProvider";
import { getTimeZone } from "@/lib/timezone";
import { checkSetup } from "@/lib/actions/diagnostics";
import { SetupIssuePanel } from "@/components/diagnostics/SetupIssuePanel";
import { listPeople } from "@/lib/actions/people";
import { listLists } from "@/lib/actions/lists";
import { getNotificationCount } from "@/lib/actions/notifications";

// This whole route group is a live, per-user dashboard — never prerender it.
export const dynamic = "force-dynamic";

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  // Load straight away; only run the database diagnostic if that fails.
  // (Checking first added a full database round trip before every page.)
  let data;
  try {
    data = await Promise.all([listPeople(), listLists(), getNotificationCount(), getTimeZone()]);
  } catch (err) {
    unstable_rethrow(err); // let Next's redirect-to-sign-in through
    const diagnostic = await checkSetup();
    if (diagnostic.ok) throw err;
    return (
      <AppShell>
        <SetupIssuePanel diagnostic={diagnostic} />
      </AppShell>
    );
  }

  const [people, lists, notificationCount, timeZone] = data;
  return (
    <TimeZoneProvider timeZone={timeZone}>
    <AppShell
      people={people.map((p) => ({ id: p.id, display_name: p.display_name }))}
      lists={lists.map((l) => ({ id: l.id, name: l.name }))}
      notificationCount={notificationCount}
    >
      {children}
    </AppShell>
    </TimeZoneProvider>
  );
}
