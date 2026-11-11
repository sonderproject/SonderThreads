import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/current-user";
import { queryOne } from "@/lib/db/client";
import { isOwner } from "@/lib/owner";
import { SETTINGS_SECTIONS, sectionForQuery } from "@/lib/settings-sections";
import { SettingsHashRedirect } from "@/components/settings/SettingsHashRedirect";
import { SignOutButton } from "@/components/settings/SettingsSections";

/** Settings: a short menu; each section opens on its own page (/settings/<section>). */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; email?: string; billing?: string }>;
}) {
  const q = await searchParams;
  // Actions that still send people to /settings?saved=… land on the right section.
  const target = sectionForQuery(q);
  if (target) {
    const qs = new URLSearchParams(Object.entries(q).filter(([, v]) => typeof v === "string") as [string, string][]);
    redirect(`/settings/${target}?${qs}`);
  }
  const userId = await requireUserId();
  const [user, owner] = await Promise.all([
    queryOne<{ email: string }>(`select email from users where id = $1`, [userId]),
    isOwner().catch(() => false),
  ]);

  return (
    <div className="max-w-md space-y-6">
      <SettingsHashRedirect />
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="text-sm text-text-muted">{user?.email}</p>
      </div>

      {owner && (
        <Link href="/owner" className="card flex items-center justify-between gap-3 p-4 hover:bg-bg-hover">
          <span className="text-sm font-semibold text-text">Command center</span>
          <span className="text-sm text-accent">Open →</span>
        </Link>
      )}

      <nav aria-label="Settings sections" className="card divide-y divide-border-subtle overflow-hidden">
        {SETTINGS_SECTIONS.map((s) => (
          <Link key={s.slug} href={`/settings/${s.slug}`} className="flex items-center justify-between gap-3 p-4 hover:bg-bg-hover">
            <span className="min-w-0">
              <span className="block text-base text-text">{s.title}</span>
              <span className="block text-xs text-text-muted">{s.hint}</span>
            </span>
            <span className="text-lg text-text-faint" aria-hidden>
              ›
            </span>
          </Link>
        ))}
      </nav>

      <SignOutButton />
    </div>
  );
}
