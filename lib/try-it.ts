/**
 * "Try it now" on the landing page: runs the app's own built-in sentence reader
 * (lib/ai/providers/fallback.ts, the same one behind the command bar's live preview)
 * against a sample account, in the browser. No AI call, no account, nothing sent.
 */
import { fallbackProvider } from "@/lib/ai/providers/fallback";
import { splitCommands } from "@/lib/ai/split";
import { matchServiceCommand } from "@/lib/service-command";
import { matchOutcome } from "@/lib/outcome-match";

export const SAMPLE_PEOPLE = [
  { id: "ana", displayName: "Ana Ortiz", firstName: "Ana", lastName: "Ortiz" },
  { id: "marcus", displayName: "Marcus Cole", firstName: "Marcus", lastName: "Cole" },
  { id: "sarah", displayName: "Sarah Kim", firstName: "Sarah", lastName: "Kim" },
  { id: "jessica", displayName: "Jessica Lee", firstName: "Jessica", lastName: "Lee" },
  { id: "john", displayName: "John Park", firstName: "John", lastName: "Park" },
  { id: "rosa", displayName: "Rosa Diaz", firstName: "Rosa", lastName: "Diaz" },
  { id: "jasmine", displayName: "Jasmine Reyes", firstName: "Jasmine", lastName: "Reyes" },
];

const SAMPLE_LISTS = [
  { id: "shopping", name: "Shopping list", isGroup: false },
  { id: "groceries", name: "Groceries", isGroup: false },
  { id: "spring", name: "Spring cohort", isGroup: true },
];

/** Services with the word each audience uses for logging one. */
const SAMPLE_SERVICES: { id: string; name: string; priceCents: number | null; kind: "Visit" | "Check-in" }[] = [
  { id: "consultation", name: "Consultation", priceCents: 12000, kind: "Visit" },
  { id: "followup", name: "Follow-up session", priceCents: 9000, kind: "Visit" },
  { id: "strategy", name: "Strategy call", priceCents: 15000, kind: "Visit" },
  { id: "session", name: "Session", priceCents: 9000, kind: "Visit" },
  { id: "housing", name: "Housing help", priceCents: null, kind: "Check-in" },
  { id: "food", name: "Food assistance", priceCents: null, kind: "Check-in" },
  { id: "job", name: "Job readiness", priceCents: null, kind: "Check-in" },
];

const SAMPLE_OUTCOMES = [
  { id: "job", name: "Got a job" },
  { id: "housing", name: "Found housing" },
  { id: "program", name: "Completed program" },
];

export type TryResult = {
  /** "Reminder set", "Note saved", ... */
  title: string;
  /** Short facts: date, person, list, amount. */
  details: string[];
  /** A one-tap follow-up the app would offer, e.g. record an outcome. */
  offer?: string;
};

const money = (cents: number) => `$${cents % 100 === 0 ? cents / 100 : (cents / 100).toFixed(2)}`;

function when(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  if (d.getHours() === 0 && d.getMinutes() === 0) return date;
  return `${date} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

function listTitle(name: string): string {
  const clean = name.replace(/^(my|our|the)\s+/i, "").trim();
  const known = SAMPLE_LISTS.find((l) => l.name.toLowerCase() === clean.toLowerCase() || l.name.toLowerCase() === `${clean} list`.toLowerCase());
  return known?.name ?? clean.charAt(0).toUpperCase() + clean.slice(1);
}

const cap = (s: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const personName = (id: string | null, fallback?: string) => SAMPLE_PEOPLE.find((p) => p.id === id)?.displayName ?? fallback ?? null;

/** What Surfdesk would do with each sentence in `input`. */
export async function tryCommand(input: string): Promise<TryResult[]> {
  const now = new Date();
  const context = { now, tzOffset: now.getTimezoneOffset(), people: SAMPLE_PEOPLE, lists: SAMPLE_LISTS };
  const out: TryResult[] = [];
  for (const sentence of splitCommands(input).slice(0, 6)) {
    const svc = matchServiceCommand(
      sentence,
      SAMPLE_PEOPLE.map((p) => ({ id: p.id, displayName: p.displayName, firstName: p.firstName })),
      SAMPLE_SERVICES,
    );
    if (svc) {
      const service = SAMPLE_SERVICES.find((s) => s.id === svc.serviceId)!;
      const amount = svc.amountCents ?? service.priceCents;
      out.push({
        title: `${service.kind} logged`,
        details: [service.name, amount !== null ? money(amount) : null, personName(svc.personId), svc.daysAgo ? "yesterday" : "today"].filter(Boolean) as string[],
        offer: service.kind === "Visit" ? "Counted in your revenue Insights" : "Counted in your Impact report",
      });
      continue;
    }
    const p = await fallbackProvider.parse(sentence, context);
    const who = personName(p.personId, p.names[0]);
    switch (p.intent) {
      case "create_task":
        out.push({
          title: p.dueDate ? "Reminder set" : "Task added",
          details: [cap(p.content), p.dueDate && when(p.dueDate), p.recurrence && `Repeats ${p.recurrence}`, who && `Linked to ${who}`].filter(Boolean) as string[],
          offer: p.dueDate ? "On your Today list and calendar that day" : "On your task list",
        });
        break;
      case "add_person_note": {
        const outcome = matchOutcome(p.content ?? sentence, SAMPLE_OUTCOMES);
        out.push({
          title: who ? `Note saved to ${who}’s profile` : "Note saved to their profile",
          details: [p.content ?? sentence],
          offer: outcome ? `Record “${outcome.name}” in one tap` : undefined,
        });
        break;
      }
      case "create_person":
        out.push({ title: p.names.length > 1 ? "People added" : "Person added", details: p.names, offer: "Profile ready for notes, visits and follow-ups" });
        break;
      case "add_to_list":
        out.push({ title: `Added to ${listTitle(p.listName ?? "your list")}`, details: p.names });
        break;
      case "create_list":
        out.push({ title: p.isGroup ? "New group" : "New list", details: [listTitle(p.listName ?? "")].filter(Boolean) });
        break;
      case "update_person_status":
        out.push({ title: `Updated ${who ? `${who}’s` : "their"} ${p.statusField === "next_action" ? "next step" : "status"}`, details: [p.content ?? ""].filter(Boolean) });
        break;
      case "search":
        out.push({ title: "Search", details: [p.content ?? sentence], offer: "Finds people, notes, tasks and lists" });
        break;
      default:
        out.push({ title: "Note saved", details: [p.content ?? sentence] });
    }
  }
  return out;
}

/** Sentences a visitor tried, kept in their browser until they sign up (then offered on the dashboard). */
export const TRY_IT_KEY = "surfdesk.tryIt";
export const TRY_IT_MAX = 5;

export function saveTried(sentences: string[]): void {
  try {
    const clean = sentences.map((s) => s.trim().slice(0, 200)).filter(Boolean).slice(-TRY_IT_MAX);
    if (clean.length) localStorage.setItem(TRY_IT_KEY, JSON.stringify({ at: Date.now(), sentences: clean }));
  } catch {
    /* storage blocked: nothing to carry over */
  }
}

/** Sentences saved in the last 14 days, or none. */
export function loadTried(): string[] {
  try {
    const raw = localStorage.getItem(TRY_IT_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as { at?: number; sentences?: unknown };
    if (!data.at || Date.now() - data.at > 14 * 864e5 || !Array.isArray(data.sentences)) return [];
    return data.sentences.filter((s): s is string => typeof s === "string").slice(0, TRY_IT_MAX);
  } catch {
    return [];
  }
}

export function clearTried(): void {
  try {
    localStorage.removeItem(TRY_IT_KEY);
  } catch {
    /* ignore */
  }
}
