// Every SQL insert in the app names as many columns as it gives values.
// (A referral-form bug in Nov 2026: a column was added without its $14, so every
// referral failed.) Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === "node_modules" || name.startsWith(".") ? [] : files(p);
    return /\.(ts|tsx|mts)$/.test(name) ? [p] : [];
  });
}

/** Text inside the parentheses that start at s[i] (which is "("), and where they end. */
function balanced(s: string, i: number): [string, number] | null {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === "(") depth++;
    else if (s[j] === ")" && --depth === 0) return [s.slice(i + 1, j), j];
  }
  return null;
}

/** Top-level comma-separated items (ignoring commas inside brackets or quotes). */
function countItems(body: string): number {
  let depth = 0;
  let n = 1;
  let quote: string | null = null;
  for (const ch of body) {
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"') quote = ch;
    else if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    else if (ch === "," && depth === 0) n++;
  }
  return n;
}

test("every insert has one value per column", () => {
  const problems: string[] = [];
  let checked = 0;
  for (const file of ["lib", "app", "components"].flatMap(files)) {
    const s = readFileSync(file, "utf8");
    for (const m of s.matchAll(/insert\s+into\s+([\w.]+)\s*\(/gi)) {
      const cols = balanced(s, m.index! + m[0].length - 1);
      if (!cols || cols[0].includes("${")) continue;
      const rest = s.slice(cols[1] + 1, cols[1] + 600);
      const values = /^\s*values\s*\(/i.exec(rest);
      const select = /^\s*select\s+/i.exec(rest);
      let body: string | null = null;
      if (values) body = balanced(rest, values[0].length - 1)?.[0] ?? null;
      else if (select) {
        const tail = rest.slice(select[0].length);
        const stop = /\s(from|where|on\s+conflict|returning)\b|`/i.exec(tail);
        body = stop ? tail.slice(0, stop.index) : tail;
      }
      if (!body || body.includes("${")) continue;
      checked++;
      const nCols = cols[0].split(",").filter((c) => c.trim()).length;
      const nValues = countItems(body);
      if (nCols !== nValues) {
        problems.push(`${file}:${s.slice(0, m.index).split("\n").length} insert into ${m[1]}: ${nCols} columns, ${nValues} values`);
      }
    }
  }
  assert.ok(checked > 50, `only found ${checked} inserts; the scan is probably broken`);
  assert.deepEqual(problems, []);
});
