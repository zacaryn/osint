import assert from "node:assert/strict";
import { dedupeWatchItems, headlineOnWatch, isEscalation } from "../shared/watch-match.ts";
import { matchesZone, zoneById } from "../shared/zones.ts";
import { WATCHES } from "../shared/watchlists.ts";

const watch = (id) => WATCHES.find((w) => w.id === id);
const caucasus = watch("caucasus");
const kashmir = watch("kashmir");
const redsea = watch("redsea");
const sahel = watch("sahel");
const flash = zoneById("flashpoints");

const indiaPak =
  'Trump continues his rhetoric on ending India-Pakistan conflict, calls Pak PM "terrific man" - ANI News';
const indiaPakCopy =
  'Trump continues his rhetoric on ending India-Pakistan conflict, calls Pak PM "terrific man" - Devdiscourse';
const f1 = "Why Formula 1 is racing in Azerbaijan, which borders Iran, amid uncertainty over Middle East races - ABC News";
const clash = "Armenia and Azerbaijan report a border clash near Nagorno-Karabakh - Reuters";
const usGeorgia = "Georgia governor sends national guard to the southern border - Atlanta Journal";
const tbilisi = "Russian troops mass on the Georgia border, Tbilisi says - BBC";
const iranPeace = "Trump Expects Peace Deal With Iran After US November Elections - Radio Free Europe";
const nigeria = "Nigeria army kills militants in Borno - Reuters";
const niger = "Niger junta says soldiers repelled an attack near Niamey - Reuters";

assert.equal(headlineOnWatch(indiaPak, caucasus), false, "India-Pakistan is not the Caucasus");
assert.equal(headlineOnWatch(indiaPakCopy, caucasus), false, "syndicated copy is not the Caucasus either");
assert.equal(headlineOnWatch(indiaPak, kashmir), true, "India-Pakistan stays on its own watch");
assert.equal(headlineOnWatch(f1, caucasus), false, "Azerbaijan Grand Prix is not a border incident");
assert.equal(headlineOnWatch(clash, caucasus), true, "a real border clash still counts");
assert.equal(isEscalation(clash, caucasus), true, "clash and border are escalation");
assert.equal(isEscalation(f1, caucasus), false, "borders is not the word border");
assert.equal(headlineOnWatch(usGeorgia, caucasus), false, "US state of Georgia is not the Caucasus");
assert.equal(headlineOnWatch(tbilisi, caucasus), true, "Georgia next to Russian troops still counts");
assert.equal(headlineOnWatch(iranPeace, redsea), false, "an Iran peace story is not the Red Sea");
assert.equal(headlineOnWatch(nigeria, sahel), false, "Nigeria is not Niger");
assert.equal(headlineOnWatch(niger, sahel), true, "Niger junta coverage stays on the Sahel");
assert.equal(
  headlineOnWatch("US, Japan and South Korea seek North Korea's denuclearization - AzerNews", watch("korea")),
  true,
  "North Korea diplomacy stays on the Korea watch",
);
assert.equal(
  headlineOnWatch("Traffic through the Strait of Hormuz has resumed, shippers say - Reuters", watch("hormuz")),
  true,
  "a Hormuz transit headline does not need a strike word",
);

const deduped = dedupeWatchItems([
  { raw: indiaPak, ts: 2 },
  { raw: indiaPakCopy, ts: 1 },
]);
assert.equal(deduped.length, 1, "identical headlines from two wires count once");
assert.equal(deduped[0].ts, 2, "the newer copy is kept");

assert.equal(matchesZone(flash, "Iran IRGC blocks tanker transit in the Strait of Hormuz"), false);
assert.equal(matchesZone(flash, "Local officials report flooding"), false);
assert.equal(matchesZone(flash, nigeria), false);
assert.equal(matchesZone(flash, "Somalia port attack"), false);
assert.equal(matchesZone(flash, clash), true);
assert.equal(matchesZone(flash, indiaPak), true);
assert.equal(matchesZone(flash, usGeorgia), false);
assert.equal(matchesZone(flash, tbilisi), true);

console.log("watch match tests ok");
