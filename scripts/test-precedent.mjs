import assert from "node:assert/strict";
import { applyPrecedent, PRECEDENT_RATIO_FLOOR, PRECEDENT_SCORE_FLOOR } from "../shared/precedent.ts";

const dprk = applyPrecedent(
  { title: "North Korea fires ballistic missile toward East Sea", zones: ["korea"], watchId: "korea" },
  18,
  "conflict",
);
assert.ok(dprk.score >= PRECEDENT_SCORE_FLOOR, "conflict floor");
assert.ok(dprk.score < 18, "dprk routine damp");
assert.ok(dprk.effect?.damped, "marked damped");

const anomaly = applyPrecedent(
  { title: "North Korea ICBM over Japan triggers alert", zones: ["korea"], watchId: "korea" },
  20,
  "conflict",
);
assert.ok(anomaly.effect?.anomaly || !anomaly.effect?.damped, "icbm treated as anomaly band");

const ratio = applyPrecedent({ title: "Korea watch", zones: ["korea"], watchId: "korea" }, 2.4, "ratio");
assert.ok(ratio.score >= PRECEDENT_RATIO_FLOOR, "ratio floor");

console.log("precedent tests ok");
