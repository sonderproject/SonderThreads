// The command center stays owner-only. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

test("every command-center page and owner action checks requireOwner()", () => {
  const targets = [...files("app/(app)/owner"), "lib/actions/owner.ts"];
  const missing: string[] = [];
  for (const f of targets) {
    const s = readFileSync(f, "utf8");
    // Each exported function (page or server action) must call requireOwner() itself.
    for (const m of s.matchAll(/export (?:default )?async function (\w+)[^{]*\{([\s\S]*?)\n\}/g)) {
      if (!/await requireOwner\(\)/.test(m[2])) missing.push(`${f}: ${m[1]}`);
    }
  }
  assert.deepEqual(missing, []);
});

test("owner needs both the pinned id and the email", async () => {
  process.env.OWNER_EMAILS = "boss@example.org";
  process.env.OWNER_USER_IDS = "11111111-1111-1111-1111-111111111111";
  // lib/owner.ts imports server-only helpers, so check its logic from the source:
  const src = readFileSync("lib/owner.ts", "utf8");
  assert.match(src, /ownerUserIds\(\)\.includes\(id\.toLowerCase\(\)\) && ownerEmails\(\)\.includes\(email\.toLowerCase\(\)\)/);
  assert.match(src, /if \(!me\.mfa_enabled\) redirect/);
});
