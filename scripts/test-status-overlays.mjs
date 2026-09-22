import assert from "node:assert/strict";
import { CHOKEPOINTS } from "../shared/chokepoint-registry.ts";
import { pipelineById } from "../shared/pipeline-registry.ts";
import {
  activeOverlays,
  mergeChokepointStatus,
  mergePipelineStatus,
} from "../shared/status-overlays.ts";

const hormuz = CHOKEPOINTS.find((c) => c.id === "hormuz");
assert.ok(hormuz);

const pauseOverlay = {
  id: "test-pause-isr-row",
  objectiveKind: "chokepoint",
  objectiveId: "hormuz",
  validFrom: "2020-01-01",
  authority: "primary",
  layer: "temporary",
  confidence: "documented",
  source: "test",
  pauseRestrictionIds: ["hormuz-isr-us-gbr-tankers"],
};

const merged = mergeChokepointStatus(hormuz, [pauseOverlay]);
assert.ok(!merged.restrictions.some((r) => r.restrictionId === "hormuz-isr-us-gbr-tankers"));
assert.ok(merged.restrictions.some((r) => r.restrictionId === "hormuz-transit-collapse"));

const petro = pipelineById("petroline");
assert.ok(petro);
const pipeOverlay = {
  id: "test-petro-reduced",
  objectiveKind: "pipeline",
  objectiveId: "petroline",
  validFrom: "2020-01-01",
  authority: "official",
  layer: "temporary",
  confidence: "documented",
  source: "test",
  pipelineStatus: "reduced",
  statusNote: "Test reduced flow",
};
const pipe = mergePipelineStatus(petro, [pipeOverlay]);
assert.equal(pipe.status, "reduced");

const expired = activeOverlays(
  [
    {
      id: "old",
      objectiveKind: "pipeline",
      objectiveId: "petroline",
      validFrom: "2020-01-01",
      validUntil: "2020-02-01",
      authority: "wire",
      layer: "temporary",
      confidence: "reported",
      source: "test",
    },
  ],
  "pipeline",
  "petroline",
);
assert.equal(expired.length, 0);

console.log("status overlay tests ok");
