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
  const ids = readFileSync("lib/owner-ids.ts", "utf8");
  assert.match(ids, /ownerUserIds\(\)\.includes\(id\.toLowerCase\(\)\) && ownerEmails\(\)\.includes\(email\.toLowerCase\(\)\)/);
  const src = readFileSync("lib/owner.ts", "utf8");
  assert.match(src, /if \(!me\.mfa_enabled\) redirect/);
});

test("owner controls never apply to the owner's own account", () => {
  const session = readFileSync("lib/session.ts", "utf8");
  // Suspension and maintenance are checked only after excluding the owner.
  assert.match(session, /if \(!isOwnerAccount\(row\.id, row\.email\)\) \{\s*if \(row\.suspended !== null\)/);
  const actions = readFileSync("lib/actions/owner.ts", "utf8");
  for (const name of ["ownerSuspend", "ownerExtendTrial", "ownerMakeFree"]) {
    const body = actions.match(new RegExp(`export async function ${name}[\\s\\S]*?\\n\\}`))?.[0] ?? "";
    assert.match(body, /targetUser\(id\)/, `${name} checks the target user`);
    assert.match(body, /targetOrg\(id\)/, `${name} checks the target organization`);
  }
  assert.match(actions, /if \(isOwnerAccount\(u\.id, u\.email\)\) throw new Error\("owner"\)/);
  assert.match(actions, /members\.some\(\(m\) => isOwnerAccount\(m\.id, m\.email\)\)/);
});
