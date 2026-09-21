/**
 * One source of truth for refresh cadence, cache lifetimes and aging rules.
 * The server pollers, the client pollers and the "How this updates" panel all
 * read these, so the explanation on screen cannot drift from the behaviour.
 */

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** How often the browser asks the API for each payload. */
export const POLL_MS = {
  snapshot: 60 * SECOND,
  deck: 90 * SECOND,
  watch: 5 * MINUTE,
  fronts: 10 * MINUTE,
  flights: 25 * SECOND,
  chokepoints: 30 * MINUTE,
  /** Country outlines and reactor coordinates. Nothing here moves inside a day. */
  atlas: 12 * HOUR,
  /** Regimes and designation rosters. OFAC publishes on business days. */
  energy: 6 * HOUR,
  /** Strategic signal register (hybrid curated + RSS). */
  signals: 30 * MINUTE,
} as const;

/** How long the API serves a cached payload before it refetches upstream. */
export const CACHE_MS = {
  news: 3 * MINUTE,
  geo: 90 * SECOND,
  deck: 2 * MINUTE,
  watch: 5 * MINUTE,
  fronts: 10 * MINUTE,
  chokepoints: 30 * MINUTE,
  chokepointNews: 30 * MINUTE,
  /** PortWatch publishes once a day and already runs a week behind, so polling it faster only burns requests. */
  chokepointTransits: 6 * HOUR,
  atlas: 24 * HOUR,
  /** Borders move on a scale of years and this payload is the largest one served. */
  countryShapes: 24 * HOUR,
  /** Reactors do not move. */
  nuclearPlants: 7 * DAY,
  /** OFAC adds names on business days, so half a day is as fast as useful. */
  sanctionsDigest: 12 * HOUR,
  /** OpenSanctions rebuilds the maritime dataset once a day. */
  shadowFleet: 24 * HOUR,
  /** The EU regime list changes when a sanctions package is adopted. */
  euRegimes: 12 * HOUR,
  /** Auto-detected strategic signals merged to data/strategic-signals.json */
  strategicSignals: 45 * MINUTE,
  /** Mexico state outlines for homicide choropleth */
  mexicoGeo: 24 * HOUR,
} as const;

/** Windows, floors and caps that decide what stays on the board. */
export const AGING = {
  /** A story stops being flagged Breaking this long after publication. */
  breakingWindowMs: 6 * HOUR,
  /** Map markers for reported events drop off after this. */
  eventWindowMs: 48 * HOUR,
  /** Conflict score a story needs before it earns a map marker. */
  eventMinConflict: 6,
  /** Wire ordering buckets by recency first, then by conflict score. */
  newsBucketMs: 90 * MINUTE,
  /** Newest items taken from each RSS feed. */
  perFeedItems: 15,
  /** Per-category allowance so a fast wire cannot crowd out slower desks. */
  perCategoryCap: 70,
  breakingCap: 25,
  eventCap: 150,
  /** Newest posts taken from each X account. */
  postsPerAccount: 20,
  /** Size of the merged chronological deck column. */
  combinedCap: 120,
  /** Items each marquee cycles through. */
  marqueeItems: 24,
  /** Tripwire measurement window. */
  watchWindowMs: 24 * HOUR,
  /** Days of headlines a tripwire pulls to build its baseline. */
  watchFeedWindowDays: 7,
  /** Days the baseline averages over (the window minus the live 24h). */
  watchBaselineDays: 6,
  /** Baseline floor, so one article in a silent theater is not infinite growth. */
  watchBaselineFloor: 0.75,
  /** Trailing days a chokepoint's transit count is measured over. */
  chokepointRecentDays: 7,
  /** Days the chokepoint baseline averages over, immediately before that window. */
  chokepointBaselineDays: 28,
  /** Daily values kept for the chokepoint sparkline. */
  chokepointSparkDays: 21,
  /** Days of headlines pulled per chokepoint. */
  chokepointNewsDays: 14,
  /** Headlines kept per chokepoint. */
  chokepointHeadlines: 4,
} as const;

export type ChannelId =
  | "snapshot"
  | "deck"
  | "watch"
  | "fronts"
  | "flights"
  | "chokepoints"
  | "atlas"
  | "energy"
  | "signals"
  | "baseline";

export type ChannelSpec = {
  id: ChannelId;
  /** Short label for status chips. */
  short: string;
  label: string;
  pollMs: number;
  cacheMs: number;
  /** What the channel feeds on screen. */
  feeds: string;
  /** Plain-language aging rule. */
  ages: string;
  /** Set when the channel only runs under some condition. */
  condition?: string;
};

export const CHANNELS: ChannelSpec[] = [
  {
    id: "snapshot",
    short: "WIRE",
    label: "News wire + hazards",
    pollMs: POLL_MS.snapshot,
    cacheMs: CACHE_MS.news,
    feeds: "Marquees, KPI rail, News tab, reported-event markers",
    ages: `Breaking flag clears ${AGING.breakingWindowMs / HOUR}h after publication; event markers expire after ${
      AGING.eventWindowMs / HOUR
    }h.`,
  },
  {
    id: "deck",
    short: "DECK",
    label: "X monitor deck",
    pollMs: POLL_MS.deck,
    cacheMs: CACHE_MS.deck,
    feeds: "Monitor columns and the merged chronological column",
    ages: `Each account contributes its newest ${AGING.postsPerAccount} posts; older posts fall off as new ones land.`,
  },
  {
    id: "watch",
    short: "TRIP",
    label: "Tripwires",
    pollMs: POLL_MS.watch,
    cacheMs: CACHE_MS.watch,
    feeds: "Zone bar colours, Watch tab, tripwire map markers",
    ages: `Always the trailing ${AGING.watchWindowMs / HOUR}h against the previous ${
      AGING.watchBaselineDays
    } days, so the score moves rather than accumulating.`,
  },
  {
    id: "fronts",
    short: "FRONT",
    label: "Front line",
    pollMs: POLL_MS.fronts,
    cacheMs: CACHE_MS.fronts,
    feeds: "Territorial control polygons and front markers",
    ages: "Replaced wholesale by the publisher's latest survey; the stamp on the map shows its date.",
  },
  {
    id: "flights",
    short: "ADSB",
    label: "Aircraft",
    pollMs: POLL_MS.flights,
    cacheMs: 20 * SECOND,
    feeds: "ADS-B contacts inside the current map view",
    ages: "Live positions only — each poll replaces the previous set.",
    condition: "Only while the Aircraft layer is on",
  },
  {
    id: "chokepoints",
    short: "CHOKE",
    label: "Chokepoint access & transits",
    pollMs: POLL_MS.chokepoints,
    cacheMs: CACHE_MS.chokepoints,
    feeds: "Chokepoint markers, restriction pips and the Chokepoints section of each zone panel",
    ages: `Access restrictions are curated and change only when this board is edited. Transit counts refresh every ${hoursLabel(
      CACHE_MS.chokepointTransits,
    )} from a series that publishes about a week late, so each popup is stamped with the actual data date; per-chokepoint headlines refresh every ${everyLabel(
      CACHE_MS.chokepointNews,
    )}.`,
  },
  {
    id: "atlas",
    short: "ATLAS",
    label: "Country outlines & civil reactors",
    pollMs: POLL_MS.atlas,
    cacheMs: CACHE_MS.atlas,
    feeds: "Alliance fills, military base markers and nuclear site markers",
    ages: `Alliance rosters, the base roster and the weapons-complex list are curated and change only when this board is edited — each popup carries its own last-verified date. Country outlines are cached for ${hoursLabel(
      CACHE_MS.countryShapes,
    )} and reduced server-side from 251 kB to about 104 kB; the reactor list refreshes every ${Math.round(
      CACHE_MS.nuclearPlants / DAY,
    )} days from an 11 MB upstream file filtered to roughly 14 kB before it leaves the server.`,
    condition: "Only while an alliance, base or nuclear layer is on",
  },
  {
    id: "energy",
    short: "NRG",
    label: "Sanctions regimes & designated vessels",
    pollMs: POLL_MS.energy,
    cacheMs: CACHE_MS.sanctionsDigest,
    feeds: "Sanctions country fills, the Energy tab and the designated-vessel list",
    ages: `Pipelines, energy sites and the regime-level framing — what the price cap is, which US orders cover energy — are curated and carry their own last-verified dates. The EU's 55 restrictive-measure regimes refresh every ${hoursLabel(
      CACHE_MS.euRegimes,
    )}; OFAC's designation arithmetic every ${hoursLabel(
      CACHE_MS.sanctionsDigest,
    )} from a 5.4 MB list reduced server-side to a few kB, stamped with OFAC's own publish date; the shadow-fleet roster every ${hoursLabel(
      CACHE_MS.shadowFleet,
    )}. Designated vessels carry no position because no source publishes one.`,
    condition: "Only while the Sanctions layer or the Energy tab is open",
  },
  {
    id: "signals",
    short: "SIG",
    label: "Strategic signals",
    pollMs: POLL_MS.signals,
    cacheMs: CACHE_MS.strategicSignals,
    feeds: "Intel Signals tab and actor strategic-signal section",
    ages: "Curated seeds persist; RSS detections merge every 45m with dedupe by country, class and title.",
  },
  {
    id: "baseline",
    short: "BASE",
    label: "Intel precedent baselines",
    pollMs: POLL_MS.snapshot,
    cacheMs: 7 * DAY,
    feeds: "Intel Baseline tab, watch precedent blurbs, damped conflict scores",
    ages: "Static curated tables with lastVerified per entry; no live fetch on the request path.",
  },
];

/**
 * Oldest a payload can legitimately be: the client poll plus the server cache
 * it may have been served from, with a little slack for slow upstreams.
 */
export function staleAfterMs(channel: ChannelSpec): number {
  return channel.pollMs + channel.cacheMs + 45 * SECOND;
}

export function channelById(id: ChannelId): ChannelSpec {
  const found = CHANNELS.find((c) => c.id === id);
  if (!found) throw new Error(`unknown channel ${id}`);
  return found;
}

/** "90s" / "5m" / "10m" for interval labels. */
export function everyLabel(ms: number): string {
  if (ms < MINUTE) return `${Math.round(ms / SECOND)}s`;
  const minutes = ms / MINUTE;
  return Number.isInteger(minutes) ? `${minutes}m` : `${Math.round(ms / SECOND)}s`;
}

export function hoursLabel(ms: number): string {
  return `${Math.round(ms / HOUR)}h`;
}
