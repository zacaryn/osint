import type { ZoneId } from "./zones.ts";

/**
 * Which zone tags count as "in scope" when a focus tab is selected.
 * Passage tabs pull relevant Mideast desks; the Mideast tab sees passage specialists too.
 */
const FOCUS_ALSO: Record<ZoneId, readonly ZoneId[]> = {
  ukraine: ["ukraine"],
  mideast: ["mideast", "hormuz", "bab"],
  hormuz: ["hormuz", "mideast"],
  bab: ["bab", "mideast"],
  indopacific: ["indopacific"],
  korea: ["korea"],
  americas: ["americas"],
  flashpoints: ["flashpoints"],
};

export function focusZoneIds(zone: ZoneId): readonly ZoneId[] {
  return FOCUS_ALSO[zone];
}

/** True when an account's zone tags belong on the deck for this focus tab. */
export function accountMatchesFocusZone(accountZones: ZoneId[], focus: ZoneId): boolean {
  if (accountZones.length === 0) return false;
  const allowed = focusZoneIds(focus);
  return accountZones.some((z) => allowed.includes(z));
}
