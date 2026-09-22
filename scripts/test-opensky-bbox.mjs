import assert from "node:assert/strict";

/** Mirror server/sources/opensky.ts clamp so the regression stays obvious. */
const MAX_BBOX_AREA = 3600;

function clampBbox(bbox) {
  let { lamin, lomin, lamax, lomax } = bbox;
  const area = Math.abs(lamax - lamin) * Math.abs(lomax - lomin);
  if (area <= MAX_BBOX_AREA) return { lamin, lomin, lamax, lomax };
  const scale = Math.sqrt(MAX_BBOX_AREA / area);
  const clat = (lamin + lamax) / 2;
  const clon = (lomin + lomax) / 2;
  const halfLat = ((lamax - lamin) / 2) * scale;
  const halfLon = ((lomax - lomin) / 2) * scale;
  return {
    lamin: clat - halfLat,
    lomin: clon - halfLon,
    lamax: clat + halfLat,
    lomax: clon + halfLon,
  };
}

const world = { lamin: -60, lomin: -180, lamax: 60, lomax: 180 };
const oldBehaviorWouldReturnEmpty = Math.abs(world.lamax - world.lamin) * Math.abs(world.lomax - world.lomin) > 900;
assert.ok(oldBehaviorWouldReturnEmpty, "world view used to exceed the old 900 cap");

const clamped = clampBbox(world);
const clampedArea =
  Math.abs(clamped.lamax - clamped.lamin) * Math.abs(clamped.lomax - clamped.lomin);
assert.ok(clampedArea <= MAX_BBOX_AREA + 0.01);
assert.ok(clampedArea > 100);

console.log("opensky bbox clamp tests ok");
