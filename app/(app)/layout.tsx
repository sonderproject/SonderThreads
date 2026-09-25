import { AppShell } from "@/components/nav/AppShell";
import { checkSetup } from "@/lib/actions/diagnostics";
import { SetupIssuePanel } from "@/components/diagnostics/SetupIssuePanel";
import { listPeople } from "@/lib/actions/people";

// This whole route group is a live, personal dashboard — never prerender it.
// Without this, Next.js can attempt to statically generate "/" at build
// time, and the demo-data seeding call (which writes to the database) then
// fails with "revalidatePath used during render is unsupported".
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

  const people = await listPeople();
  return <AppShell people={people.map((p) => ({ id: p.id, display_name: p.display_name }))}>{children}</AppShell>;
}
