import assert from "node:assert/strict";
import { DEFAULT_ACCOUNTS } from "../shared/accounts.ts";
import { accountMatchesFocusZone } from "../shared/zone-deck.ts";
import { ZONES } from "../shared/zones.ts";

const MIN_TAGGED = 3;

for (const zone of ZONES) {
  const tagged = DEFAULT_ACCOUNTS.filter((a) => accountMatchesFocusZone(a.zones, zone.id));
  assert.ok(
    tagged.length >= MIN_TAGGED,
    `${zone.id} (${zone.short}): only ${tagged.length} tagged deck accounts (need >= ${MIN_TAGGED})`,
  );
}

const globals = DEFAULT_ACCOUNTS.filter((a) => a.zones.length === 0);
assert.ok(globals.length >= 8, `expected at least 8 global deck accounts, got ${globals.length}`);

/** Every zone id should appear on at least one account or feed keyword path is separate. */
const covered = new Set();
for (const a of DEFAULT_ACCOUNTS) {
  for (const z of a.zones) covered.add(z);
}
for (const z of ZONES) {
  assert.ok(covered.has(z.id), `no deck account tagged for zone ${z.id}`);
}

console.log(`account coverage ok (${ZONES.length} zones, ${DEFAULT_ACCOUNTS.length} accounts, ${globals.length} global)`);
