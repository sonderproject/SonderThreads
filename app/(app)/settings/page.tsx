import { TwoFactorCard } from "@/components/settings/TwoFactorCard";
import { DeleteAccountCard } from "@/components/settings/DeleteAccountCard";
import { ChangePasswordCard } from "@/components/settings/ChangePasswordCard";
import { requireUserId } from "@/lib/current-user";
import { queryOne } from "@/lib/db/client";

/**
 * Settings (placeholder for the full Settings screen): account security and
 * account deletion live here.
 */
export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const userId = await requireUserId();
  const user = await queryOne<{ email: string; mfa_enabled: boolean }>(
    `select email, mfa_enabled from users where id = $1`,
    [userId],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="text-sm text-text-muted">{user?.email}</p>
      </div>

      <section className="space-y-3">
        <h2 className="eyebrow text-text-faint">Security</h2>
        <TwoFactorCard enabled={Boolean(user?.mfa_enabled)} />
        <ChangePasswordCard />
      </section>

      <section className="space-y-3">
        <h2 className="eyebrow text-text-faint">Account</h2>
        <DeleteAccountCard error={error === "confirm" || error === "delete-login" ? error : undefined} />
      </section>
    </div>
  );
}
