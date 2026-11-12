/**
 * Recognizes "log a service" sentences in the command bar, such as
 * "Ana - haircut", "Marcus bought catering $200" or "Jo had a consultation
 * yesterday". Pure (no imports) so it's easy to test.
 *
 * Deliberately strict: it needs a known person, a service from the list, and
 * either a separator right after the name or a past-tense verb, and it ignores
 * anything that sounds like a plan ("needs a haircut tomorrow") so tasks and
 * reminders still go to the normal parser.
 */

export type ServicePerson = { id: string; displayName: string; firstName: string };
export type ServiceOption = { id: string; name: string };
export type ServiceMatch = { personId: string; serviceId: string; amountCents: number | null; daysAgo: number };

const FUTURE = /\b(remind|reminder|need|needs|needed|should|will|want|wants|tomorrow|tonight|next|todo|to-do|schedule|scheduled|follow up|follow-up|later|upcoming|going to|gonna|every)\b/;
const VERBS = /\b(got|had|has had|bought|purchased|ordered|received|used|did|paid for|came in for|came for|took|redeemed|signed up for|booked)\b/;

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findWhole(haystack: string, needle: string): number {
  const m = new RegExp(`(^|[^a-z0-9])${escape(needle)}(?=$|[^a-z0-9])`).exec(haystack);
  return m ? m.index + m[1].length : -1;
}

export function matchServiceCommand(input: string, people: ServicePerson[], services: ServiceOption[]): ServiceMatch | null {
  const text = input.toLowerCase().replace(/\s+/g, " ").trim();
  if (!text || !services.length || !people.length || FUTURE.test(text)) return null;

  // Longest service name that appears as whole words ("hair color" before "color").
  let service: ServiceOption | null = null;
  let serviceAt = -1;
  for (const s of [...services].sort((a, b) => b.name.length - a.name.length)) {
    const at = findWhole(text, s.name.toLowerCase());
    if (at >= 0) {
      service = s;
      serviceAt = at;
      break;
    }
  }
  if (!service) return null;

  // The person: full name first; otherwise a first name only if exactly one person has it.
  let person: ServicePerson | null = null;
  let nameEnd = -1;
  for (const p of [...people].sort((a, b) => b.displayName.length - a.displayName.length)) {
    const n = p.displayName.toLowerCase();
    const at = findWhole(text, n);
    if (at >= 0 && (at + n.length <= serviceAt || at >= serviceAt + service.name.length)) {
      person = p;
      nameEnd = at + n.length;
      break;
    }
  }
  if (!person) {
    const byFirst = new Map<string, ServicePerson[]>();
    for (const p of people) {
      const f = p.firstName.toLowerCase();
      if (f.length > 1) byFirst.set(f, [...(byFirst.get(f) ?? []), p]);
    }
    for (const [first, list] of byFirst) {
      const at = findWhole(text, first);
      if (at >= 0 && list.length === 1 && (at + first.length <= serviceAt || at >= serviceAt + service.name.length)) {
        person = list[0];
        nameEnd = at + first.length;
        break;
      }
    }
  }
  if (!person) return null;

  // "Ana - haircut", "Ana: haircut", "Ana, haircut", or a past-tense verb anywhere.
  const separated = /^\s*[-–—:,]/.test(text.slice(nameEnd));
  if (!separated && !VERBS.test(text)) return null;

  const money = /\$\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?/.exec(text);
  const amountCents = money ? Number(money[1].replace(/,/g, "")) * 100 + (money[2] ? Number(money[2].padEnd(2, "0")) : 0) : null;
  const daysAgo = /\byesterday\b/.test(text) ? 1 : 0;

  return { personId: person.id, serviceId: service.id, amountCents, daysAgo };
}
