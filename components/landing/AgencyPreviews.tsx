/**
 * Landing page, "For teams": four small, static previews of the organization
 * screens (Team dashboard, Impact report, Referrals, Activity log). Sample
 * data only, drawn with the app's tokens; not screenshots of anyone's account.
 */
export function AgencyPreviews() {
  return (
    <div className="grid gap-3 sm:grid-cols-2" aria-label="Previews with sample data">
      <Preview title="Team dashboard" caption="Every staff member's clients and today's check-ins.">
        <ul className="space-y-1.5 text-xs">
          {[
            ["Maria G.", "Manager", 18, 4],
            ["Andre P.", "Member", 23, 6],
            ["Kim L.", "Member", 15, 3],
          ].map(([name, role, clients, today]) => (
            <li key={name as string} className="rounded-lg border border-border-subtle px-2 py-1.5">
              <span className="flex items-center justify-between gap-2">
                <span className="font-medium text-text">{name}</span>
                <span className="text-text-muted">{role}</span>
              </span>
              <span className="block tabular-nums text-text-muted">
                {clients} clients · <strong className="text-accent">{today} today</strong>
              </span>
            </li>
          ))}
        </ul>
      </Preview>

      <Preview title="Impact report" caption="People served, new vs returning, demographics. PDF in one click.">
        <div className="grid grid-cols-3 gap-1.5 text-center">
          {[
            ["212", "People served"],
            ["64", "New"],
            ["1.9", "Visits each"],
          ].map(([n, l]) => (
            <div key={l} className="rounded-lg border border-border-subtle px-1 py-1.5">
              <p className="font-display text-lg font-light tabular-nums text-text">{n}</p>
              <p className="text-[10px] leading-tight text-text-muted">{l}</p>
            </div>
          ))}
        </div>
        <div className="mt-2 space-y-1" aria-hidden>
          {[
            ["Housing help", 82],
            ["Food assistance", 61],
            ["Job readiness", 44],
          ].map(([l, w]) => (
            <div key={l as string} className="flex items-center gap-2 text-[10px] text-text-muted">
              <span className="w-24 shrink-0 truncate">{l}</span>
              <span className="h-1.5 rounded-full bg-accent" style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
      </Preview>

      <Preview title="Referrals" caption="Partners send clients through your link; you see them instantly.">
        <ul className="space-y-1.5 text-xs">
          {[
            ["Jasmine R.", "From: County Health", "Tue 10:30", true],
            ["Omar S.", "From: Eastside Shelter", "Wed 2:00", false],
          ].map(([name, from, when, isNew]) => (
            <li key={name as string} className="rounded-lg border border-border-subtle px-2 py-1.5">
              <span className="flex items-center justify-between gap-2">
                <span className="font-medium text-text">{name}</span>
                {isNew && <span className="tag">New</span>}
              </span>
              <span className="block text-text-muted">
                {from} · appt {when}
              </span>
            </li>
          ))}
        </ul>
      </Preview>

      <Preview title="Activity log" caption="Who changed what, and when. Admins see it all.">
        <ul className="space-y-1 text-[11px] leading-snug text-text-muted">
          {[
            ["9:41", "Andre added a check-in for Luis M."],
            ["9:12", "Maria moved 3 clients to Kim"],
            ["8:57", "Kim updated Rosa D.'s phone"],
            ["8:30", "Front desk kiosk: 2 sign-ins"],
          ].map(([t, line]) => (
            <li key={t} className="flex gap-2">
              <span className="w-8 shrink-0 tabular-nums text-text-faint">{t}</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </Preview>
    </div>
  );
}

function Preview({ title, caption, children }: { title: string; caption: string; children: React.ReactNode }) {
  return (
    <figure className="card flex flex-col gap-2 p-4">
      <p className="eyebrow text-text-faint">{title}</p>
      <div className="flex-1" aria-hidden>
        {children}
      </div>
      <figcaption className="text-xs text-text-muted">{caption}</figcaption>
    </figure>
  );
}
