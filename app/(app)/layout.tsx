import { AppShell } from "@/components/nav/AppShell";
import { checkSupabaseConnection } from "@/lib/actions/diagnostics";
import { SetupIssuePanel } from "@/components/diagnostics/SetupIssuePanel";

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const diagnostic = await checkSupabaseConnection();

  if (!diagnostic.ok) {
    return (
      <AppShell>
        <SetupIssuePanel diagnostic={diagnostic} />
      </AppShell>
    );
  }

  return <AppShell>{children}</AppShell>;
}
