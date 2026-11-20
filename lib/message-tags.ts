/**
 * Team message tags, with no database or browser code so they can be tested
 * (scripts/message-tags.test.mts). In a stored body a client is <#person-id>
 * and a teammate <@user-id>; the composer shows them as "#Name" / "@Name".
 */

export type Segment =
  | { t: "text"; v: string }
  | { t: "client"; id: string | null; name: string }
  | { t: "user"; id: string; name: string };

export type TagOption = { kind: "client" | "user"; id: string; name: string };

export const TOKEN_RE = /<([#@])([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})>/gi;

/** Ids tagged in a body, split into clients and teammates (lowercase). */
export function tagIds(body: string): { clients: Set<string>; users: Set<string> } {
  const clients = new Set<string>();
  const users = new Set<string>();
  for (const m of body.matchAll(TOKEN_RE)) (m[1] === "#" ? clients : users).add(m[2].toLowerCase());
  return { clients, users };
}

/**
 * Splits a stored body into text and tags for one reader. `clients` holds only
 * the clients this reader may see; anyone else shows as "a client".
 */
export function parseBody(body: string, clients: Map<string, string>, users: Map<string, string>): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of body.matchAll(TOKEN_RE)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ t: "text", v: body.slice(last, at) });
    const id = m[2].toLowerCase();
    if (m[1] === "#") {
      const name = clients.get(id);
      out.push(name ? { t: "client", id, name } : { t: "client", id: null, name: "a client" });
    } else {
      out.push({ t: "user", id, name: users.get(id) ?? "teammate" });
    }
    last = at + m[0].length;
  }
  if (last < body.length) out.push({ t: "text", v: body.slice(last) });
  return out;
}

/** The body as the composer shows it ("#Name", "@Name"), for editing. */
export function editTextOf(segments: Segment[]): string {
  return segments.map((s) => (s.t === "text" ? s.v : s.t === "user" ? `@${s.name}` : s.id ? `#${s.name}` : s.name)).join("");
}

/** Turns the "#Name" / "@Name" picked in the composer into stored tags (longest names first). */
export function encodeTags(text: string, picked: TagOption[]): string {
  let out = text;
  for (const p of [...picked].sort((a, b) => b.name.length - a.name.length)) {
    const sign = p.kind === "client" ? "#" : "@";
    out = out.split(`${sign}${p.name}`).join(`<${sign}${p.id}>`);
  }
  return out;
}

/** A "#word" or "@word" being typed right before the cursor, if any. */
export function activeTrigger(text: string, caret: number): { kind: "client" | "user"; start: number; q: string } | null {
  const m = text.slice(0, caret).match(/(^|\s)([#@])([^\s#@]{0,40})$/);
  if (!m) return null;
  return { kind: m[2] === "#" ? "client" : "user", start: caret - m[3].length - 1, q: m[3] };
}

/** A short preview for the inbox list, with tags shown generically. */
export function previewOf(body: string): string {
  return body.replace(TOKEN_RE, (_, k: string) => (k === "#" ? "#client" : "@teammate")).slice(0, 120);
}
