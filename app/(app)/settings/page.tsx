import { TwoFactorCard } from "@/components/settings/TwoFactorCard";
import { requireUserId } from "@/lib/current-user";
import { queryOne } from "@/lib/db/client";

/**
 * Settings (placeholder for the full Settings screen): account security and
 * account deletion live here.
 */
export default async function SettingsPage() {
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
      </section>
    </div>
  );
}
