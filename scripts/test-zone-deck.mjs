import assert from "node:assert/strict";
import { accountMatchesFocusZone, focusZoneIds } from "../shared/zone-deck.ts";

assert.deepEqual(focusZoneIds("bab"), ["bab", "mideast"]);
assert.equal(accountMatchesFocusZone(["mideast"], "bab"), true);
assert.equal(accountMatchesFocusZone(["hormuz"], "bab"), false);
assert.equal(accountMatchesFocusZone(["ukraine"], "bab"), false);
assert.equal(accountMatchesFocusZone(["hormuz", "bab"], "mideast"), true);

console.log("zone deck tests ok");
