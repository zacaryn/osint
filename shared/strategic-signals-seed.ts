import type { StrategicSignalClass } from "./strategic-signal-types.ts";

export type StrategicSignalSeed = {
  id: string;
  iso3: string;
  class: StrategicSignalClass;
  title: string;
  summary: string;
  observedAt: string;
  source: string;
  sourceUrl: string;
  confidence: "documented" | "reported";
};

/** Curated examples cited in the plan — always shown even before RSS detection runs. */
export const STRATEGIC_SIGNAL_SEED: StrategicSignalSeed[] = [
  {
    id: "uk-resilience-2024",
    iso3: "GBR",
    class: "civil_preparedness",
    title: "UK government resilience messaging and local preparedness guidance",
    summary: "Whitehall and local resilience forums published updated public guidance on sheltering and emergency alerts.",
    observedAt: "2024-05-12",
    source: "UK Government Resilience Framework updates",
    sourceUrl: "https://www.gov.uk/government/publications",
    confidence: "documented",
  },
  {
    id: "pl-lt-evac-2024",
    iso3: "POL",
    class: "evacuation_planning",
    title: "Poland–Lithuania contingency evacuation planning exercises",
    summary: "Allied ministries referenced non-combatant evacuation and border corridor drills tied to Suwałki-gap scenarios.",
    observedAt: "2024-03-18",
    source: "NATO PA / national defence ministry statements",
    sourceUrl: "https://www.nato.int",
    confidence: "reported",
  },
  {
    id: "lt-evac-2024",
    iso3: "LTU",
    class: "evacuation_planning",
    title: "Lithuania public evacuation route updates",
    summary: "Civil protection agencies refreshed route maps and shelter capacity figures for border counties.",
    observedAt: "2024-04-02",
    source: "Lithuanian Ministry of the Interior",
    sourceUrl: "https://lrv.lt",
    confidence: "reported",
  },
  {
    id: "fr-hybrid-2024",
    iso3: "FRA",
    class: "hybrid_counter",
    title: "France hybrid-threat counter framework",
    summary: "Paris outlined inter-agency hybrid response cells after sabotage incidents on critical infrastructure.",
    observedAt: "2024-06-20",
    source: "French Ministry of Armed Forces",
    sourceUrl: "https://www.defense.gouv.fr",
    confidence: "documented",
  },
  {
    id: "nato-de-command-2024",
    iso3: "DEU",
    class: "alliance_posture",
    title: "NATO logistics command footprint in Germany",
    summary: "Allied statements referenced expanded NATO support and logistics coordination in Germany.",
    observedAt: "2024-09-05",
    source: "NATO / Bundeswehr press",
    sourceUrl: "https://www.nato.int",
    confidence: "documented",
  },
];
