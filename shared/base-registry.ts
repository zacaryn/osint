/**
 * The assembled base roster and the lookups the map and the panels share.
 *
 * Split by operator rather than by region because the analytical question this
 * layer answers is "whose forces are where", and because keeping the US, Russian
 * and Chinese rosters in separate files keeps each one short enough to audit.
 */
import { OTHER_BASES } from "./bases-other.ts";
import { RUS_BASES } from "./bases-rus.ts";
import { US_BASES } from "./bases-us.ts";
import type { BaseBranch, MilitaryBase } from "./military-bases.ts";
import type { Zone } from "./zones.ts";

export const BASES: MilitaryBase[] = [...US_BASES, ...RUS_BASES, ...OTHER_BASES];

export function baseById(id: string): MilitaryBase | undefined {
  return BASES.find((b) => b.id === id);
}

/** Operators present in the roster, most installations first, for the legend. */
export function baseOperators(): { iso3: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const b of BASES) counts.set(b.operator, (counts.get(b.operator) ?? 0) + 1);
  return [...counts.entries()]
    .map(([iso3, count]) => ({ iso3, count }))
    .sort((a, b) => b.count - a.count || a.iso3.localeCompare(b.iso3));
}

export function basesByBranch(): Record<BaseBranch, number> {
  const out: Record<BaseBranch, number> = { air: 0, naval: 0, joint: 0, land: 0, "space-radar": 0 };
  for (const b of BASES) out[b.branch] += 1;
  return out;
}

/** Everything inside a zone's box, worst-defined status last so active leads. */
export function basesForZone(zone: Zone): MilitaryBase[] {
  const [south, west, north, east] = zone.bbox;
  const rank = { active: 0, "under-construction": 1, reported: 2, closed: 3 } as const;
  return BASES.filter((b) => b.lat >= south && b.lat <= north && b.lon >= west && b.lon <= east).sort(
    (a, b) => rank[a.status] - rank[b.status] || a.name.localeCompare(b.name),
  );
}

/** Every installation an actor operates or hosts — the two halves of the actor view. */
export function basesForActor(iso3: string): { operated: MilitaryBase[]; hosted: MilitaryBase[] } {
  return {
    operated: BASES.filter((b) => b.operator === iso3 && b.hostCountry !== iso3),
    hosted: BASES.filter((b) => b.hostCountry === iso3 && b.operator !== iso3),
  };
}
