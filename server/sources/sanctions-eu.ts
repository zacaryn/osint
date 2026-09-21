/**
 * EU Sanctions Map — the cleanest structured statement of "which embargoes exist"
 * that is available without a key.
 *
 * SOURCE CHOICE. Every alternative was probed. The designation bulk files (OFAC
 * 5.4 MB, EU FSD 24 MB, UK OFSI 15.9 MB, UN 2.1 MB) list *names* and say almost
 * nothing about what a regime prohibits. This endpoint is 387 kB and returns 55
 * regimes each with a typed measure list, which is the only source found that can
 * answer "sectoral or listings-only" — the distinction the whole sanctions layer
 * is built around. `/api/v1/country` 404s; the country is a field inside each
 * regime instead.
 *
 * MEASURE CLASS IS DERIVED, NOT ASSERTED. The feed states typed measures and no
 * class, so classifyMeasures() in shared/sanctions.ts reads the measure
 * vocabulary. Every regime therefore lands at `confidence: "reported"` unless it
 * carries enough measures to be unambiguous — this board does not claim a
 * classification the source did not make.
 */
import { CACHE_MS } from "../../shared/cadence.ts";
import { iso3FromIso2 } from "../../shared/flags.ts";
import { classifyMeasures, isEnergyMeasure, isTerritorial } from "../../shared/sanctions.ts";
import type { SanctionsRegimeDigest } from "../../shared/types.ts";
import { cached } from "../cache.ts";
import { fetchJson } from "../http.ts";

const SOURCE = "https://www.sanctionsmap.eu/api/v1/regime";

export const EU_REGIMES_ATTRIBUTION = "EU Sanctions Map (EEAS/Estonian EU Presidency)";
export const EU_REGIMES_URL = "https://www.sanctionsmap.eu/";

type Wrapped<T> = { data?: T } | T;

type RawMeasure = {
  description?: string;
  suspend?: boolean;
  type?: Wrapped<{ title?: string }>;
};

type RawRegime = {
  id?: number;
  acronym?: string | null;
  specification?: string;
  notes?: string;
  has_lists?: boolean;
  adopted_by?: Wrapped<{ title?: string }>;
  country?: Wrapped<{ code?: string; title?: string }>;
  measures?: Wrapped<RawMeasure[]>;
  legal_acts?: Wrapped<{ title?: string; number?: string; url?: string }[]>;
};

/** The API wraps nearly every nested object in `{ data: ... }`. */
function unwrap<T>(value: Wrapped<T> | undefined): T | undefined {
  if (value && typeof value === "object" && "data" in (value as object)) {
    return (value as { data?: T }).data;
  }
  return value as T | undefined;
}

/** "Restrictive measures in view of Russia's actions..." is unusable as a chip. */
function shortName(raw: RawRegime, countryTitle: string | undefined): string {
  const base = countryTitle ?? "Thematic";
  const clean = base.replace(/\s*\(.*\)\s*$/, "");
  return raw.acronym ? `${clean} — ${raw.acronym}` : clean;
}

/** First whole sentence that fits, else a hard cut — never a truncated word. */
function firstSentence(text: string | undefined, max = 220): string {
  if (!text) return "";
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const head = flat.slice(0, max);
  const stop = head.lastIndexOf(". ");
  if (stop > 80) return head.slice(0, stop + 1);
  const space = head.lastIndexOf(" ");
  return `${head.slice(0, space > 80 ? space : max - 1)}…`;
}

function reduce(raw: RawRegime, generatedAt: string): SanctionsRegimeDigest | null {
  if (raw.id === undefined) return null;
  const measures = unwrap(raw.measures) ?? [];
  const titles = measures
    .map((m) => unwrap(m.type)?.title)
    .filter((t): t is string => Boolean(t));
  if (titles.length === 0) return null;

  const country = unwrap(raw.country);
  const iso3 = country?.code ? iso3FromIso2(country.code) : undefined;
  const act = (unwrap(raw.legal_acts) ?? [])[0];
  const adoptedBy = unwrap(raw.adopted_by)?.title ?? "EU";

  return {
    id: `eu-regime-${raw.id}`,
    name: raw.specification ?? shortName(raw, country?.title),
    short: shortName(raw, country?.title),
    // "UN and EU" regimes are transposed into EU law, so the EU is the enforcer
    // this board can point at an instrument for.
    authority: adoptedBy === "UN" ? "UN" : "EU",
    measureClass: classifyMeasures(titles),
    targets: iso3 ? [iso3] : [],
    territorial: isTerritorial(raw.specification ?? "") || undefined,
    energy: titles.some(isEnergyMeasure),
    /** Capped: Russia's economic regime lists 66 measures across 20-odd types. */
    sectors: [...new Set(titles)].sort().slice(0, 10),
    measureCount: measures.length,
    suspendedCount: measures.filter((m) => m.suspend === true).length,
    instrument: act?.number ? `${act.title ?? "Council act"} — ${act.number}` : (act?.title ?? "Council decision"),
    instrumentUrl: act?.url ?? EU_REGIMES_URL,
    note: firstSentence(raw.notes),
    kind: adoptedBy === "UN" ? "treaty" : "state-action",
    // The class is this board's reading of the measure list, not the EU's own
    // label, so it is never presented as documented.
    confidence: measures.length >= 10 ? "documented" : "reported",
    live: true,
    lastVerified: generatedAt.slice(0, 10),
  };
}

export async function loadEuRegimes(): Promise<SanctionsRegimeDigest[]> {
  return cached("eu-regimes", CACHE_MS.euRegimes, async () => {
    const { data } = await fetchJson<Wrapped<RawRegime[]>>(SOURCE, 25000);
    const list = unwrap(data) ?? [];
    const flat = Array.isArray(list) ? list.flat() : [];
    if (flat.length === 0) throw new Error("EU Sanctions Map returned no regimes");

    const generatedAt = new Date().toISOString();
    return flat
      .map((raw) => reduce(raw, generatedAt))
      .filter((r): r is SanctionsRegimeDigest => r !== null)
      .sort((a, b) => b.measureCount - a.measureCount);
  });
}
