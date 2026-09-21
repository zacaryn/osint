/**
 * IMF PortWatch daily chokepoint transit counts.
 *
 * THE CROSS-COMPARABILITY TRAP: these counts are not comparable between
 * chokepoints. Each figure is whatever AIS traffic fell inside that
 * chokepoint's own detection polygon, and the polygons differ wildly in size,
 * so Malacca reporting 215 transits on the same day Hormuz reports 8 says
 * nothing about their relative importance. Every ratio here therefore divides a
 * chokepoint by ITS OWN trailing history and never by another chokepoint,
 * mirroring how server/sources/watch.ts scores tripwires.
 *
 * The series also runs about a week behind, so it is a trend instrument, not a
 * live feed. The data date travels with the payload and is shown on screen.
 */
import { AGING, CACHE_MS } from "../../shared/cadence.ts";
import { CHOKEPOINTS } from "../../shared/chokepoint-registry.ts";
import type { ChokepointShift, ChokepointTraffic, ChokepointTrafficTrend } from "../../shared/types.ts";
import { cached } from "../cache.ts";
import { fetchJson } from "../http.ts";

const BASE = "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services";
const LAYER = `${BASE}/Daily_Chokepoints_Data/FeatureServer/0/query`;

export const PORTWATCH_ATTRIBUTION = "IMF PortWatch";
export const PORTWATCH_TERMS = "https://www.imf.org/external/terms.htm";

const DAY_MS = 86_400_000;
/** The long-run reference window ends well before the recent window so the two never overlap. */
const REFERENCE_LAG_DAYS = 180;
const REFERENCE_SPAN_DAYS = 365;
/** Below this many transits a day the ratio is arithmetic noise, not signal. */
const LOW_BASELINE = 5;
/** The layer caps any single query at 1000 rows, so only ask for the ids we render. */
const MAX_ROWS = 1000;

const TRACKED_IDS = [...new Set(CHOKEPOINTS.map((c) => c.portwatchId).filter((id): id is string => Boolean(id)))];

/**
 * Widest window that still fits one page, so the fetch absorbs a publication
 * lag several times the usual week without a second round trip. Derived from
 * the id count so adding a chokepoint cannot quietly overrun the cap.
 */
const FETCH_DAYS = Math.min(80, Math.floor(MAX_ROWS / Math.max(TRACKED_IDS.length, 1)));

type DailyRow = {
  date: string;
  portid: string;
  n_total: number | null;
  n_tanker: number | null;
};

type QueryResponse<T> = { features?: { attributes: T }[]; error?: { message?: string } };

function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function round(value: number, places = 2): number {
  const f = 10 ** places;
  return Math.round(value * f) / f;
}

async function query<T>(where: string, extra: Record<string, string>): Promise<{ attributes: T }[]> {
  const params = new URLSearchParams({
    where,
    returnGeometry: "false",
    f: "json",
    ...extra,
  });
  const { data } = await fetchJson<QueryResponse<T>>(`${LAYER}?${params}`, 25000);
  if (data.error) throw new Error(`PortWatch: ${data.error.message ?? "query rejected"}`);
  return data.features ?? [];
}

/**
 * Daily rows for the tracked chokepoints, grouped by PortWatch id. Ordered
 * newest first so that if the row cap ever bites it drops the oldest days,
 * which would only shorten the baseline rather than silently rewind the
 * data date by a month.
 */
async function loadDailyRows(from: string): Promise<Map<string, DailyRow[]>> {
  const ids = TRACKED_IDS.map((id) => `'${id}'`).join(",");
  const features = await query<DailyRow>(`date >= DATE '${from}' AND portid IN (${ids})`, {
    outFields: "date,portid,n_total,n_tanker",
    orderByFields: "date DESC",
    resultRecordCount: String(MAX_ROWS),
  });

  const byId = new Map<string, DailyRow[]>();
  for (const { attributes } of features) {
    if (!attributes?.portid) continue;
    const rows = byId.get(attributes.portid);
    if (rows) rows.push(attributes);
    else byId.set(attributes.portid, [attributes]);
  }
  for (const rows of byId.values()) rows.sort((a, b) => a.date.localeCompare(b.date));
  return byId;
}

/** One grouped statistics call gives every chokepoint's long-run mean for 2 KB. */
async function loadReferenceMeans(from: string, to: string): Promise<Map<string, number>> {
  const features = await query<{ portid: string; mean_total: number | null }>(
    `date >= DATE '${from}' AND date <= DATE '${to}'`,
    {
      outStatistics: JSON.stringify([
        { statisticType: "avg", onStatisticField: "n_total", outStatisticFieldName: "mean_total" },
      ]),
      groupByFieldsForStatistics: "portid",
    },
  );
  const out = new Map<string, number>();
  for (const { attributes } of features) {
    if (attributes?.portid && attributes.mean_total != null) out.set(attributes.portid, attributes.mean_total);
  }
  return out;
}

function trendFor(ratio: number, recent: number, baseline: number): ChokepointTrafficTrend {
  if (recent < 0.5 && baseline < 1) return "idle";
  if (ratio >= 1.15) return "above";
  if (ratio <= 0.85) return "below";
  return "normal";
}

function shiftFor(ratio: number): ChokepointShift {
  if (ratio < 0.5) return "collapsed";
  if (ratio < 0.85) return "down";
  if (ratio > 1.5) return "surged";
  if (ratio > 1.15) return "up";
  return "steady";
}

function buildTraffic(
  rows: DailyRow[],
  reference: number | undefined,
  referenceFrom: string,
  referenceTo: string,
): ChokepointTraffic | undefined {
  const usable = rows.filter((r) => r.n_total != null);
  if (usable.length < AGING.chokepointRecentDays + AGING.chokepointBaselineDays) return undefined;

  const totals = usable.map((r) => Number(r.n_total));
  const recentSlice = totals.slice(-AGING.chokepointRecentDays);
  const baselineSlice = totals.slice(
    -(AGING.chokepointRecentDays + AGING.chokepointBaselineDays),
    -AGING.chokepointRecentDays,
  );

  const recent = mean(recentSlice);
  const baseline = mean(baselineSlice);
  const ratio = recent / Math.max(baseline, 0.5);
  const dataDate = usable.at(-1)?.date ?? "";
  const lagDays = Math.max(
    0,
    Math.round((Date.now() - new Date(`${dataDate}T00:00:00Z`).getTime()) / DAY_MS),
  );

  const traffic: ChokepointTraffic = {
    recent: round(recent, 1),
    baseline: round(baseline, 1),
    ratio: round(ratio),
    trend: trendFor(ratio, recent, baseline),
    tankerRecent: round(mean(usable.slice(-AGING.chokepointRecentDays).map((r) => Number(r.n_tanker ?? 0))), 1),
    dataDate,
    lagDays,
    spark: usable.slice(-AGING.chokepointSparkDays).map((r) => Number(r.n_total)),
    quality: baseline < LOW_BASELINE ? "low" : "ok",
  };

  // A year-old mean catches a step change that the 28-day baseline has already
  // absorbed — a passage quiet for two months looks "normal" against itself.
  if (reference != null && reference > 0) {
    const longRatio = recent / Math.max(reference, 0.5);
    traffic.longRun = {
      reference: round(reference, 1),
      from: referenceFrom,
      to: referenceTo,
      ratio: round(longRatio),
      shift: shiftFor(longRatio),
    };
  }

  return traffic;
}

/** Transit trend per PortWatch chokepoint id. Keyed by portwatchId, not by our own ids. */
export async function loadChokepointTraffic(): Promise<Map<string, ChokepointTraffic>> {
  return cached("portwatch-transits", CACHE_MS.chokepointTransits, async () => {
    const now = Date.now();
    const from = isoDay(now - FETCH_DAYS * DAY_MS);
    const referenceTo = isoDay(now - REFERENCE_LAG_DAYS * DAY_MS);
    const referenceFrom = isoDay(now - (REFERENCE_LAG_DAYS + REFERENCE_SPAN_DAYS) * DAY_MS);

    const [daily, reference] = await Promise.all([
      loadDailyRows(from),
      loadReferenceMeans(referenceFrom, referenceTo).catch(() => new Map<string, number>()),
    ]);

    const out = new Map<string, ChokepointTraffic>();
    for (const [portid, rows] of daily) {
      const traffic = buildTraffic(rows, reference.get(portid), referenceFrom, referenceTo);
      if (traffic) out.set(portid, traffic);
    }
    return out;
  });
}
