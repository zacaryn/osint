import type { WatchDefinition } from "./watchlists.ts";

/**
 * Security-desk vocabulary. A place name alone is not a tripwire hit: Formula 1
 * in Azerbaijan names the Caucasus and is still not a border incident.
 * "border" is exact so the verb "borders" does not count.
 */
const COVERAGE = [
  "talks",
  "peace",
  "ceasefire",
  "killed",
  "dead",
  "wounded",
  "war",
  "conflict",
  "attack",
  "troop",
  "troops",
  "army",
  "soldier",
  "drone",
  "missile",
  "shelling",
  "shell",
  "military",
  "border",
  "clash",
  "offensive",
  "strike",
  "invasion",
  "incursion",
  "mobilization",
  "artillery",
  "blockade",
  "seizure",
  "seized",
  "hijack",
  "coup",
  "militant",
  "nuclear",
  "explosion",
  "bomb",
  "airstrike",
  "airspace",
  "sanction",
  "fighting",
  "front line",
  "frontline",
];

const EXACT = new Set(["border"]);

/** Headline before the trailing " - Publisher" Google News appends. */
export function storyTitle(raw: string): string {
  const idx = raw.lastIndexOf(" - ");
  return (idx > 20 ? raw.slice(0, idx) : raw).trim();
}

export function normalizeWatchText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/['’]s\b/g, "")
    .replace(/['’]/g, "")
    .replace(/[-/]+/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Whole-word match. A trailing s/es counts, except for terms in EXACT. */
export function hasTerm(text: string, term: string): boolean {
  const hay = normalizeWatchText(text);
  const needle = normalizeWatchText(term);
  if (!needle) return false;
  const body = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");
  const plural = EXACT.has(needle) ? "" : "(?:s|es)?";
  return new RegExp(`(?:^|\\s)${body}${plural}(?:\\s|$)`).test(hay);
}

function anchorOk(title: string, watch: WatchDefinition): boolean {
  const hits = watch.anchors.filter((term) => hasTerm(title, term));
  if (hits.length === 0) return false;
  return hits.some((term) => {
    const rule = watch.anchorWith?.find((r) => r.term === term);
    if (!rule) return true;
    return rule.with.some((extra) => hasTerm(title, extra));
  });
}

function onSubject(title: string, watch: WatchDefinition): boolean {
  return [...watch.escalation, ...COVERAGE].some((term) => hasTerm(title, term));
}

/** True when this headline is actually about the theater, not a related-result. */
export function headlineOnWatch(raw: string, watch: WatchDefinition): boolean {
  const title = storyTitle(raw);
  if (!anchorOk(title, watch)) return false;
  if (!watch.requireSubject) return true;
  return onSubject(title, watch);
}

export function isEscalation(raw: string, watch: WatchDefinition): boolean {
  const title = storyTitle(raw);
  return watch.escalation.some((term) => hasTerm(title, term));
}

/** First eight significant words, so syndicated copies from two wires collapse. */
export function headlineKey(raw: string): string {
  const words = normalizeWatchText(storyTitle(raw))
    .split(" ")
    .filter((word) => word.length > 3);
  return words.slice(0, 8).join(" ") || normalizeWatchText(storyTitle(raw));
}

export function dedupeWatchItems<T extends { raw: string; ts: number }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of [...items].sort((a, b) => b.ts - a.ts)) {
    const key = headlineKey(item.raw);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
