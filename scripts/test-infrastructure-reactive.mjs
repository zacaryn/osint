import assert from "node:assert/strict";
import { assessReactive, effectiveGeneralSeverity } from "../shared/infrastructure-reactive.ts";
import { classifyHeadline } from "../shared/reactive-language.ts";
import { CHOKEPOINTS } from "../shared/chokepoint-registry.ts";

const now = () => new Date().toISOString();

/** Regression table — add a row when wire copy misfires in production. */
const LANGUAGE_CASES = [
  {
    title: "Iran IRGC blocks tanker transit in Strait of Hormuz",
    kind: "chokepoint",
    expect: { claim: "access_worse", strength: "strong" },
  },
  {
    title: "Houthis Vow Not To Attack US Ships In Red Sea, Warn Countries Backing Saudi Arabia",
    kind: "chokepoint",
    expect: { claim: "access_better", strength: "strong" },
  },
  {
    title: "Yemen ceasefire brings pause in Red Sea vessel attacks",
    kind: "chokepoint",
    expect: { claim: "ceasefire_lull", strength: "strong" },
  },
  {
    title: "Hormuz closure feared by analysts as tensions rise",
    kind: "chokepoint",
    expect: { claim: "access_worse", strength: "weak" },
  },
  {
    title: "Republicans launch fresh attack on the economy ahead of midterms",
    kind: "chokepoint",
    expect: null,
  },
  {
    title: "Shipping reroutes around Cape after missile hit on tanker in Red Sea",
    kind: "chokepoint",
    expect: { claim: "infrastructure_attack", strength: "strong" },
  },
  {
    title: "Saudi East-West pipeline shut down after drone strike on pumping station",
    kind: "pipeline",
    expect: { claim: "infrastructure_attack", strength: "strong" },
  },
  {
    title: "Petroline flows restored after maintenance, Aramco says",
    kind: "pipeline",
    expect: { claim: "access_better", strength: "strong" },
  },
  {
    title: "Houthi leader says group will stop attacking ships linked to Israel",
    kind: "chokepoint",
    expect: { claim: "access_better", strength: "strong" },
  },
  {
    title: "Strait may reopen next week if talks succeed, officials say",
    kind: "chokepoint",
    expect: { claim: "access_better", strength: "weak" },
  },
  {
    title: "Shipping reroutes away from Bab al-Mandab after attack on tanker in Red Sea",
    kind: "chokepoint",
    expect: { claim: "infrastructure_attack", strength: "strong" },
  },
  {
    title: "Panama Canal transit denied for sanctioned LNG carrier",
    kind: "chokepoint",
    expect: { claim: "access_worse", strength: "strong" },
  },
  {
    title: "Israel and Hamas resume peace talks in Cairo after deadly strike",
    kind: "chokepoint",
    expect: null,
  },
  {
    title: "East-West pipeline shut down for scheduled maintenance next week, Aramco says",
    kind: "pipeline",
    expect: null,
  },
  {
    title: "Houthis say they will not target Chinese-flagged vessels in Red Sea",
    kind: "chokepoint",
    expect: { claim: "access_better", strength: "strong" },
  },
  {
    title: "Suez Canal blocked after grounding of large container ship",
    kind: "chokepoint",
    expect: { claim: "access_worse", strength: "strong" },
  },
  {
    title: "War risk insurance premiums surge for Red Sea shipping after latest attack",
    kind: "chokepoint",
    expect: { claim: "access_worse", strength: "strong" },
  },
  {
    title: "Republicans launch fresh attack on the budget bill in Senate",
    kind: "chokepoint",
    expect: null,
  },
  {
    title: "Druzhba pipeline flows reduced after partial shutdown for inspection",
    kind: "pipeline",
    expect: { claim: "flow_disruption", strength: "strong" },
  },
];

for (const row of LANGUAGE_CASES) {
  const hit = classifyHeadline(row.title, row.kind);
  if (row.expect === null) {
    assert.equal(hit, null, `expected null for: ${row.title}`);
  } else {
    assert.ok(hit, `expected hit for: ${row.title}`);
    assert.equal(hit.claim, row.expect.claim, row.title);
    assert.equal(hit.strength, row.expect.strength, row.title);
  }
}

const hormuz = CHOKEPOINTS.find((c) => c.id === "hormuz");
assert.ok(hormuz);

const reutersAlone = assessReactive(
  [{ title: "Iran IRGC blocks tanker transit in Strait of Hormuz", source: "Reuters", url: "https://x/1", publishedAt: now() }],
  "chokepoint",
);
assert.ok(reutersAlone);
assert.equal(reutersAlone.confidence, "provisional");

const weakAlone = assessReactive(
  [{ title: "Hormuz closure feared by analysts as tensions rise", source: "Random Blog", url: "https://x/2", publishedAt: now() }],
  "chokepoint",
);
assert.ok(weakAlone);
assert.equal(weakAlone.confidence, "lead");

const withTraffic = assessReactive(
  [{ title: "Shipping reroutes away from Bab al-Mandab after attack on tanker", source: "Local News", url: "https://x/3", publishedAt: now() }],
  "chokepoint",
  { trend: "idle", longRun: { shift: "collapsed" } },
);
assert.ok(withTraffic);
assert.equal(withTraffic.confidence, "provisional");

assert.ok(["closed", "denied"].includes(effectiveGeneralSeverity(hormuz, reutersAlone)));

console.log(`infrastructure reactive tests ok (${LANGUAGE_CASES.length} language cases)`);
