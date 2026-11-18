import Link from "next/link";
import { notFound } from "next/navigation";
import { getTimeZone } from "@/lib/timezone";
import { getMembership } from "@/lib/org";
import { dayKey } from "@/lib/tz";
import { addDays, normalizeRange } from "@/lib/metrics-shared";
import { listServiceRecipients, serviceInScope } from "@/lib/actions/service-people";
import { ServicePeople } from "@/components/services/ServicePeople";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

/** One service: everyone who got it in a date range (default the last 12 months), with dates. */
export default async function ServicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string; to?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const [service, tz, membership] = await Promise.all([serviceInScope(id), getTimeZone(), getMembership()]);
  if (!service) notFound();
  const today = dayKey(new Date(), tz);
  const range = normalizeRange(sp.from ?? addDays(today, -364), sp.to ?? today, today);
  const rows = await listServiceRecipients(service.id, range.from, range.to, tz);
  const people = new Set(rows.map((r) => r.personId)).size;
  const value = rows.reduce((n, r) => n + (r.amountCents ?? 0), 0);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-1">
        <p className="eyebrow text-text-faint">Service{service.archived ? " (retired)" : ""}</p>
        <h1 className="page-title">{service.name}</h1>
        <p className="text-sm text-text-muted">
          {rows.length.toLocaleString()} {rows.length === 1 ? "time" : "times"} · {people.toLocaleString()} {people === 1 ? "person" : "people"}
          {value ? ` · ${formatMoney(value)}` : ""}
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-2 text-xs text-text-muted">
        <label className="space-y-1">
          <span className="block">From</span>
          <input type="date" name="from" defaultValue={range.from} max={today} className="input w-auto tabular-nums" />
        </label>
        <label className="space-y-1">
          <span className="block">To</span>
          <input type="date" name="to" defaultValue={range.to} max={today} className="input w-auto tabular-nums" />
        </label>
        <button type="submit" className="rounded-full border border-border px-3 py-2 text-sm font-medium text-text hover:bg-bg-hover">
          Show
        </button>
        <Link href={`/services/${service.id}?${new URLSearchParams({ from: addDays(today, -364), to: today })}`} className="px-2 py-2 text-sm text-accent hover:underline">
          Last 12 months
        </Link>
      </form>

      <ServicePeople
        serviceId={service.id}
        serviceName={service.name}
        from={range.from}
        to={range.to}
        tz={tz}
        rows={rows.map((r) => ({ ...r, at: new Date(r.at).toISOString() }))}
        showLoggedBy={Boolean(membership?.active)}
      />
    </div>
  );
}
