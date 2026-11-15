// Every $n passed to a report query must appear in it, or Postgres refuses the whole query
// ("could not determine data type of parameter $2"). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("report queries use every parameter they're given", () => {
  const src = readFileSync("lib/metrics.ts", "utf8");
  const problems: string[] = [];
  let checked = 0;
  // run<...>(`sql`, [params]) calls; `...range` is 4 values ($1–$4), then any extras.
  // SQL pieces kept in constants (const INTAKE_DATE = `...`), filled in where the query uses ${INTAKE_DATE}.
  const pieces = new Map([...src.matchAll(/const (\w+) = `([^`]*)`/g)].map((p) => [p[1], p[2]]));
  const expand = (sql: string) => sql.replace(/\$\{(\w+)\}/g, (all, name) => pieces.get(name) ?? all);
  for (const m of src.matchAll(/run<[^>]*>\(\s*`([\s\S]*?)`,\s*\[([^\]]*)\]/g)) {
    const sql = expand(expand(m[1]));
    const parts = m[2].split(",").map((p) => p.trim()).filter(Boolean);
    const count = parts.reduce((n, p) => n + (p === "...range" ? 4 : 1), 0);
    checked++;
    for (let i = 1; i <= count; i++) {
      if (!new RegExp(`\\$${i}(?!\\d)`).test(sql)) problems.push(`$${i} unused in: ${sql.trim().slice(0, 80)}`);
    }
  }
  assert.ok(checked > 5, "found the report queries");
  assert.deepEqual(problems, []);
});
