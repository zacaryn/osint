/**
 * Strategic signal taxonomy — slow-burn national posture narratives.
 */
export type StrategicSignalClass =
  | "civil_preparedness"
  | "evacuation_planning"
  | "hybrid_counter"
  | "alliance_posture"
  | "mobilization_rhetoric"
  | "nuclear_posture"
  | "economic_war";

export type StrategicSignalClassSpec = {
  id: StrategicSignalClass;
  label: string;
  severityWeight: number;
  decayHalfLifeDays: number;
  keywords: string[];
};

export const STRATEGIC_SIGNAL_CLASSES: StrategicSignalClassSpec[] = [
  {
    id: "civil_preparedness",
    label: "Civil preparedness",
    severityWeight: 0.35,
    decayHalfLifeDays: 120,
    keywords: ["civil defence", "civil defense", "resilience", "shelter", "preparedness", "protect and survive"],
  },
  {
    id: "evacuation_planning",
    label: "Evacuation planning",
    severityWeight: 0.45,
    decayHalfLifeDays: 90,
    keywords: ["evacuation plan", "repatriation", "contingency plan", "non-combatant evacuation", "NEO"],
  },
  {
    id: "hybrid_counter",
    label: "Hybrid counter",
    severityWeight: 0.4,
    decayHalfLifeDays: 60,
    keywords: ["hybrid warfare", "hybrid threat", "sabotage", "influence operation", "grey zone"],
  },
  {
    id: "alliance_posture",
    label: "Alliance posture",
    severityWeight: 0.5,
    decayHalfLifeDays: 45,
    keywords: ["NATO command", "enhanced forward presence", "troop deployment", "allied posture", "permanent stationing"],
  },
  {
    id: "mobilization_rhetoric",
    label: "Mobilization rhetoric",
    severityWeight: 0.55,
    decayHalfLifeDays: 30,
    keywords: ["mobilization", "general mobilization", "wartime footing", "conscription", "reserve call-up"],
  },
  {
    id: "nuclear_posture",
    label: "Nuclear posture",
    severityWeight: 0.7,
    decayHalfLifeDays: 60,
    keywords: ["nuclear sharing", "tactical nuclear", "strategic deterrent", "readiness level"],
  },
  {
    id: "economic_war",
    label: "Economic war",
    severityWeight: 0.35,
    decayHalfLifeDays: 45,
    keywords: ["sectoral sanctions", "export controls", "decoupling", "critical minerals", "energy weapon"],
  },
];

export function classSpec(id: StrategicSignalClass): StrategicSignalClassSpec {
  const found = STRATEGIC_SIGNAL_CLASSES.find((c) => c.id === id);
  if (!found) throw new Error(`unknown signal class ${id}`);
  return found;
}
