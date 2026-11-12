import Link from "next/link";
import type { SeatUsage } from "@/lib/billing";

/** "12 of 30 seats used · 18 left", with a bar and a link to change seats (admins). */
export function SeatSummary({ seats, canManage }: { seats: SeatUsage; canManage: boolean }) {
  if (seats.purchased === null) return null;
  const used = seats.active + seats.pending;
  const left = Math.max(0, seats.purchased - used);
  return (
    <section className="card space-y-2 p-4" aria-label="Seats">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-text">
          <span className="text-lg font-semibold tabular-nums">{used}</span> of{" "}
          <span className="tabular-nums">{seats.purchased}</span> seats used ·{" "}
          <strong className={`tabular-nums ${left === 0 ? "text-urgent" : "text-accent"}`}>
            {left} {left === 1 ? "seat" : "seats"} left
          </strong>
        </p>
        {canManage && (
          <Link href="/billing" className="text-sm font-medium text-accent hover:underline">
            {left === 0 ? "Add seats" : "Change seats"}
          </Link>
        )}
      </div>
      <div className="progress-bar" aria-hidden>
        <span style={{ width: `${Math.min(100, (used / seats.purchased) * 100)}%` }} />
      </div>
      <p className="text-xs text-text-muted">
        {seats.active} {seats.active === 1 ? "member" : "members"}
        {seats.pending ? ` and ${seats.pending} pending ${seats.pending === 1 ? "invite" : "invites"}` : ""}. Pending invites hold a
        seat until they&apos;re accepted, cancelled or expire.
      </p>
    </section>
  );
}
