import Link from "next/link";
import { notFound } from "next/navigation";
import { SETTINGS_SECTIONS, isSettingsSlug } from "@/lib/settings-sections";
import { SettingsSection, type SettingsQuery } from "@/components/settings/SettingsSections";

/** One Settings section on its own page, with a way back to the menu. */
export default async function SettingsSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<SettingsQuery>;
}) {
  const { section } = await params;
  if (!isSettingsSlug(section)) notFound();
  const q = await searchParams;
  const meta = SETTINGS_SECTIONS.find((s) => s.slug === section)!;

  return (
    <div className="max-w-md space-y-6">
      <div className="space-y-1">
        <Link href="/settings" className="text-sm text-accent hover:underline">
          ‹ Settings
        </Link>
        <h1 className="page-title">{meta.title}</h1>
        <p className="text-sm text-text-muted">{meta.hint}</p>
      </div>
      <div className="space-y-3">
        <SettingsSection slug={section} q={q} />
      </div>
    </div>
  );
}
