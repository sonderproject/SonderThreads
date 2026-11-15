import { query } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { AUTOMATIONS, DAILY_CAP } from "@/lib/automations";
import { saveAutomations } from "@/lib/actions/automations";

/** Settings → Automations. */
export async function AutomationsSection({ q }: { q: { saved?: string } }) {
  const userId = await requireUserId();
  const [rules, recent] = await Promise.all([
    query<{ kind: string; enabled: boolean; days: number }>(`select kind, enabled, days from automation_rules where user_id = $1`, [userId]),
    query<{ n: number }>(`select count(*)::int as n from automation_runs where user_id = $1 and created_at > now() - interval '7 days'`, [userId]),
  ]);
  const made = recent[0]?.n ?? 0;
  return (
    <form action={saveAutomations} className="card space-y-5 p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-text">Follow-ups Surfdesk adds for you</h3>
        <p className="text-xs text-text-muted">
          Each one adds a task to your Tasks (and your reminders) for the people assigned to you, so nobody slips through the cracks. At most{" "}
          {DAILY_CAP} a day per rule. {made > 0 ? `${made} added in the last 7 days.` : ""}
        </p>
      </div>
      {AUTOMATIONS.map((a) => {
        const r = rules.find((x) => x.kind === a.kind);
        const days = r?.days ?? a.defaultDays;
        return (
          <fieldset key={a.kind} className="space-y-2 border-t border-border pt-4 first-of-type:border-0 first-of-type:pt-0">
            <label className="flex items-center gap-2 text-sm font-semibold text-text">
              <input type="checkbox" name={`${a.kind}_on`} value="1" defaultChecked={r?.enabled ?? false} className="h-4 w-4 accent-[var(--accent)]" />
              {a.title}
            </label>
            <p className="pl-6 text-xs text-text-muted">{a.describe(days)}</p>
            <label className="flex items-center gap-2 pl-6 text-xs text-text-muted">
              {a.kind === "birthday" ? "When" : "After"}
              <select name={`${a.kind}_days`} defaultValue={days} className="input w-auto py-1 text-sm">
                {a.days.map((d) => (
                  <option key={d} value={d}>
                    {a.kind === "birthday" ? (d === 0 ? "On the day" : `${d} ${d === 1 ? "day" : "days"} before`) : `${d} ${d === 1 ? "day" : "days"}`}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
        );
      })}
      {q.saved === "automations" && <p className="text-xs text-accent">Saved. New tasks show up within a few minutes.</p>}
      <button type="submit" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg hover:bg-accent-dim">
        Save
      </button>
    </form>
  );
}
