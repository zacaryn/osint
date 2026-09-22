/**
 * Critical infrastructure the board watches closely — chokepoints, bypass lines,
 * and European trunk gas. News queries live here so pipeline geometry files stay
 * geometry-only.
 */
import type { ZoneId } from "./zones.ts";

export type PipelineNewsWatch = {
  pipelineId: string;
  zone: ZoneId;
  query: string;
  match: string[];
};

/** High-value lines where status moves on weekly news cycles. */
export const PIPELINE_NEWS_WATCH: PipelineNewsWatch[] = [
  {
    pipelineId: "petroline",
    zone: "hormuz",
    query:
      '("East-West" OR Petroline OR "Abqaiq" Yanbu) (pipeline OR crude OR drone OR attack OR operating OR shutdown OR capacity)',
    match: ["petroline", "east-west", "abqaiq", "yanbu", "saudi pipeline", "aramco pipeline"],
  },
  {
    pipelineId: "adcop",
    zone: "hormuz",
    query: '(ADCOP OR "Abu Dhabi Crude" Fujairah Habshan) pipeline (attack OR operating OR shutdown)',
    match: ["adcop", "fujairah", "habshan", "adnoc pipeline"],
  },
  {
    pipelineId: "dolphin",
    zone: "hormuz",
    query: '("Dolphin gas" OR "Dolphin Energy") pipeline (Qatar UAE Oman gas)',
    match: ["dolphin", "dolphin energy", "ras laffan", "taweelah"],
  },
  {
    pipelineId: "kirkuk-ceyhan",
    zone: "mideast",
    query: '("Kirkuk Ceyhan" OR "Iraq Turkey pipeline") (flow OR restart OR sabotage OR suspended)',
    match: ["kirkuk", "ceyhan", "iraq turkey pipeline", "botas"],
  },
  {
    pipelineId: "yamal-europe",
    zone: "ukraine",
    query: '("Yamal-Europe" OR Yamal Europe) pipeline (gas OR flow OR Poland OR Germany OR transit)',
    match: ["yamal", "yamal-europe", "yamal europe"],
  },
  {
    pipelineId: "turkstream",
    zone: "mideast",
    query: '(TurkStream OR "Turk Stream") pipeline (gas OR Black Sea OR Bulgaria OR Serbia)',
    match: ["turkstream", "turk stream"],
  },
  {
    pipelineId: "nord-stream-1",
    zone: "ukraine",
    query: '("Nord Stream" OR Nordstream) (pipeline OR sabotage OR gas OR Baltic)',
    match: ["nord stream", "nordstream", "baltic connector"],
  },
  {
    pipelineId: "nord-stream-2",
    zone: "ukraine",
    query: '("Nord Stream 2" OR NS2) (pipeline OR sabotage OR gas OR Baltic)',
    match: ["nord stream 2", "ns2", "nordstream"],
  },
  {
    pipelineId: "druzhba-north",
    zone: "ukraine",
    query: '(Druzhba OR "Friendship pipeline") (crude OR flow OR leak OR Poland OR Belarus)',
    match: ["druzhba", "friendship pipeline"],
  },
  {
    pipelineId: "druzhba-south",
    zone: "ukraine",
    query: '(Druzhba OR "Friendship pipeline" Ukraine Hungary) (crude OR flow OR leak)',
    match: ["druzhba", "friendship pipeline", "ukraine crude"],
  },
];

/** Chokepoint ids that should always show overlay + headline scrutiny in UI copy. */
export const CRITICAL_CHOKEPOINT_IDS = [
  "hormuz",
  "bab-al-mandab",
  "suez",
  "bosphorus",
] as const;
