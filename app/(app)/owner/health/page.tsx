import type { Metadata } from "next";
import Link from "next/link";
import { requireOwner } from "@/lib/owner";
import { OwnerNav, when } from "@/components/owner/OwnerNav";
import { healthChecks } from "@/lib/owner-stats";
import { getAppSettings } from "@/lib/app-settings";

export const metadata: Metadata = { title: "Health · Command center", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Supabase Pro includes 8 GB of database disk. */
const DB_LIMIT_BYTES = 8 * 1024 ** 3;

type Check = { label: string; ok: boolean; detail: string; fix?: string };

function ago(v: string | null): number {
  return v ? Date.now() - new Date(v).getTime() : Infinity;
}

/** Green/red: is each moving part working? */
export default async function OwnerHealthPage() {
  await requireOwner();
  const [h, app] = await Promise.all([healthChecks(), getAppSettings()]);
  const dbBytes = Number(h?.db_bytes ?? 0);
  const HOUR = 3_600_000;
  const checks: Check[] = [
    {
      label: "Email sending",
      ok: (h?.email_failed_24h ?? 0) === 0 && ago(h?.last_email ?? null) < 7 * 24 * HOUR,
      detail: `Last email sent ${when(h?.last_email ?? null)}${h?.email_failed_24h ? ` · ${h.email_failed_24h} failed in 24h` : ""}`,
      fix: "Check Resend and RESEND_API_KEY / EMAIL_FROM in Vercel.",
    },
    {
      label: "Stripe webhook",
      ok: (h?.webhook_failed_24h ?? 0) === 0,
      detail: `Last event received ${when(h?.last_webhook ?? null)}${h?.webhook_failed_24h ? ` · ${h.webhook_failed_24h} failed in 24h` : ""}`,
      fix: "In Stripe, open the webhook for thesurfdesk.app/api/stripe/webhook and check its signing secret matches Vercel.",
    },
    {
      label: "Reminders job (every 5 minutes)",
      ok: ago(h?.last_cron ?? null) < 30 * 60_000,
      detail: `Last run ${when(h?.last_cron ?? null)}`,
      fix: "Check Vercel → Cron Jobs and CRON_SECRET.",
    },
    {
      label: "Server errors (24 hours)",
      ok: (h?.errors_24h ?? 0) === 0,
      detail: h?.errors_24h ? `${h.errors_24h} errors; details on the Overview tab under Problems` : "None",
    },
    {
      label: "Database size",
      ok: dbBytes < DB_LIMIT_BYTES * 0.8,
      detail: `${(dbBytes / 1024 ** 2).toFixed(0)} MB of 8 GB (${((dbBytes / DB_LIMIT_BYTES) * 100).toFixed(1)}%)`,
      fix: "Over 80%: plan more disk in Supabase.",
    },
    {
      label: "Maintenance mode",
      ok: !app.maintenanceOn,
      detail: app.maintenanceOn ? "ON: everyone but you is locked out" : "Off",
      fix: "Turn it off on the Controls tab.",
    },
  ];
  // Set or not only (values are never read here).
  const setup: { label: string; on: boolean; note: string }[] = [
    { label: "Marketing & tip emails", on: Boolean(process.env.POSTAL_ADDRESS), note: "POSTAL_ADDRESS (a PO box is fine)" },
    { label: "Push notifications", on: Boolean(process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY), note: "VAPID keys" },
    { label: "Text reminders", on: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_MESSAGING_SERVICE_SID), note: "Twilio + 10DLC" },
    { label: "AI features", on: Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY), note: "OpenAI / Anthropic keys" },
  ];

  return (
    <div className="max-w-3xl space-y-8">
      <OwnerNav active="/owner/health" title="Health" intro="Is everything that runs in the background working?" />

      <section className="card divide-y divide-border">
        {checks.map((c) => (
          <div key={c.label} className="flex items-start gap-3 p-4">
            <span
              aria-hidden
              className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${c.ok ? "bg-accent" : "bg-danger"}`}
            />
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-semibold text-text">
                {c.label} <span className="sr-only">{c.ok ? "OK" : "needs attention"}</span>
              </p>
              <p className="text-xs text-text-muted">{c.detail}</p>
              {!c.ok && c.fix && <p className="text-xs text-text">{c.fix}</p>}
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="section-label">Waiting on a setting</h2>
        <div className="card divide-y divide-border">
          {setup.map((s) => (
            <div key={s.label} className="flex items-center justify-between gap-3 p-4 text-sm">
              <span className="text-text">{s.label}</span>
              <span className={s.on ? "tag tag-v" : "tag tag-u"}>{s.on ? "On" : `Off · ${s.note}`}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-text-faint">
          Set these in{" "}
          <Link href="https://vercel.com/dsv9130-6667s-projects/sonder-threads/settings/environment-variables" className="text-accent hover:underline">
            Vercel → Environment variables
          </Link>
          , then redeploy. Health stamps started Nov 15, 2026, so &ldquo;never&rdquo; can mean &ldquo;not since then&rdquo;.
        </p>
      </section>
    </div>
  );
}
