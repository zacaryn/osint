import type { FeedCategory } from "./feeds.ts";
import type { StrategicSignalClass } from "./strategic-signal-types.ts";
import type { ReactiveAssessment } from "./infrastructure-reactive.ts";
import type { InfrastructureOverlay } from "./status-overlays.ts";
import type { TensionLevel } from "./watchlists.ts";
import type { ZoneId } from "./zones.ts";

export type SourceHealth = {
  id: string;
  ok: boolean;
  ms?: number;
  error?: string;
  count?: number;
};

export type MediaItem = {
  type: string;
  url: string;
  poster?: string;
};

export type TweetAuthor = {
  name: string;
  handle: string;
  avatar: string;
  followers: number;
  verified: boolean;
  description?: string;
};

export type Tweet = {
  id: string;
  url: string;
  text: string;
  createdAt: string;
  createdTs: number;
  likes: number;
  replies: number;
  reposts: number;
  views: number;
  sensitive: boolean;
  media: MediaItem[];
  author: TweetAuthor;
  repostedBy?: string;
};

export type AccountColumn = {
  handle: string;
  name: string;
  accent: string;
  blurb?: string;
  zones: ZoneId[];
  state?: string;
  analysis?: boolean;
  profile?: TweetAuthor;
  tweets: Tweet[];
  /** Measured posts per day from the fetched window. */
  cadence: number;
  /** Ranking weight used to order the deck. */
  score: number;
  lastPostTs: number;
  error?: string;
  fetchedAt: string;
};

export type GeoPoint = {
  id: string;
  kind: "quake" | "gdacs" | "storm" | "fire" | "volcano" | "iss" | "flight" | "firm" | "explosion";
  title: string;
  detail?: string;
  lat: number;
  lon: number;
  mag?: number;
  alert?: string;
  when?: string;
  url?: string;
  extra?: Record<string, string | number | boolean | null>;
};

export type NewsItem = {
  id: string;
  title: string;
  source: string;
  sourceId: string;
  category: FeedCategory;
  weight: number;
  url: string;
  publishedAt?: string;
  publishedTs: number;
  summary?: string;
  breaking: boolean;
  /** 0 when nothing conflict-related was detected in the headline. */
  conflict: number;
  /** Zones whose keywords the headline matched. */
  zones: ZoneId[];
  /** Precedent dampening applied after conflict scoring. */
  precedent?: {
    baselineId: string;
    damped: boolean;
    anomaly: boolean;
    blurb: string;
  };
  /** Gazetteer places named in the headline, for plotting on the map. */
  places: ReportedPlace[];
};

export type ReportedPlace = {
  name: string;
  lat: number;
  lon: number;
};

/** A conflict story pinned to a location, rendered as a map marker. */
export type ReportedEvent = {
  id: string;
  title: string;
  source: string;
  url: string;
  lat: number;
  lon: number;
  place: string;
  conflict: number;
  zones: ZoneId[];
  precedent?: NewsItem["precedent"];
  publishedAt?: string;
  publishedTs: number;
};

export type Kpis = {
  quakes24h: number;
  maxMag: number;
  gdacsRed: number;
  gdacsOrange: number;
  storms: number;
  fires: number;
  volcanoes: number;
};

export type Snapshot = {
  generatedAt: string;
  kpis: Kpis;
  points: GeoPoint[];
  news: NewsItem[];
  breaking: NewsItem[];
  events: ReportedEvent[];
  health: SourceHealth[];
};

export type DeckPayload = {
  generatedAt: string;
  columns: AccountColumn[];
  combined: Tweet[];
};

export type FlightPoint = {
  icao24: string;
  callsign: string;
  origin: string;
  lat: number;
  lon: number;
  alt?: number;
  velocity?: number;
  track?: number;
};

export type GeocodeHit = {
  label: string;
  lat: number;
  lon: number;
};

/**
 * A single territorial-control polygon.
 * "claim" covers the publisher's historical/irredentist polygons (Kaliningrad,
 * Karelia, the Kurils and so on), which are not part of the live front.
 */
export type FrontLineArea = {
  id: string;
  label: string;
  status: "occupied" | "contested" | "liberated" | "claim" | "other";
  fill: string;
  stroke: string;
  /** Leaflet ring order: [lat, lon][][] */
  rings: [number, number][][];
};

export type FrontLineMarker = {
  id: string;
  label: string;
  lat: number;
  lon: number;
  detail?: string;
};

export type FrontLine = {
  id: string;
  name: string;
  updatedAt: string;
  areas: FrontLineArea[];
  markers: FrontLineMarker[];
  attribution: string;
  url: string;
};

export type WatchHeadline = {
  title: string;
  url: string;
  source: string;
  publishedAt?: string;
};

export type TheaterWatch = {
  id: string;
  name: string;
  level: TensionLevel;
  /** 24h volume vs the theater's own 7-day daily baseline. */
  ratio: number;
  /** ratio + 0.25×escalationHits — drives level thresholds and the activity meter. */
  tensionScore: number;
  last24h: number;
  baselinePerDay: number;
  escalationHits: number;
  center: [number, number];
  zoom: number;
  headlines: WatchHeadline[];
  precedent?: NewsItem["precedent"];
  error?: string;
};

export type WatchPayload = {
  generatedAt: string;
  watches: TheaterWatch[];
};

export type FrontPayload = {
  generatedAt: string;
  fronts: FrontLine[];
  health: SourceHealth[];
};

/** Recent transits against the chokepoint's own 28-day baseline. */
export type ChokepointTrafficTrend = "above" | "normal" | "below" | "idle";

/** Recent transits against the chokepoint's own long-run mean. */
export type ChokepointShift = "collapsed" | "down" | "steady" | "up" | "surged";

export type ChokepointTraffic = {
  /** Mean transits per day over the trailing window ending at dataDate. */
  recent: number;
  /** Mean transits per day over the days immediately before that window. */
  baseline: number;
  /**
   * recent / baseline. Only ever meaningful against this same chokepoint —
   * PortWatch detection polygons differ in size, so absolute counts and
   * therefore ratios between chokepoints are not comparable.
   */
  ratio: number;
  trend: ChokepointTrafficTrend;
  tankerRecent: number;
  /** Newest day in the upstream series, which publishes about a week late. */
  dataDate: string;
  lagDays: number;
  /** Trailing daily totals for the sparkline, oldest first. */
  spark: number[];
  /** "low" when the baseline is too small for the ratio to carry meaning. */
  quality: "ok" | "low";
  /** Absent when the long-run window returned nothing for this chokepoint. */
  longRun?: {
    reference: number;
    from: string;
    to: string;
    ratio: number;
    shift: ChokepointShift;
  };
};

export type ChokepointHeadline = {
  title: string;
  source: string;
  url: string;
  publishedAt?: string;
};

/** The moving part of a chokepoint. Curated status lives in shared/chokepoint-registry.ts. */
export type ChokepointReport = {
  id: string;
  traffic?: ChokepointTraffic;
  headlines: ChokepointHeadline[];
  /** Live headline + traffic triage — does not replace curated registry or overlays. */
  reactive?: ReactiveAssessment;
};

export type PipelineReport = {
  id: string;
  headlines: ChokepointHeadline[];
  reactive?: ReactiveAssessment;
};

export type ChokepointPayload = {
  generatedAt: string;
  /** Newest upstream data date across all chokepoints, for the map stamp. */
  dataDate: string;
  reports: ChokepointReport[];
  /** Reviewed time-bounded corrections — see data/infrastructure-overlays.json */
  overlays: InfrastructureOverlay[];
  overlaysUpdatedAt?: string;
  pipelineReports: PipelineReport[];
  attribution: string;
  attributionUrl: string;
  health: SourceHealth[];
};

/**
 * One country's outline, keyed by ISO A3 so alliance membership can join to it
 * directly. Field names are single letters because this ships ~100 countries and
 * the key names would otherwise be a measurable share of the payload.
 */
export type CountryShape = {
  /** ISO 3166-1 alpha-3. */
  i: string;
  /** Polygons, each an array of rings, each ring [lon, lat] pairs. */
  p: [number, number][][][];
};

/** A civil nuclear power station, reduced from the WRI Global Power Plant Database. */
export type NuclearPlant = {
  id: string;
  name: string;
  /** ISO3 as published by WRI. */
  country: string;
  lat: number;
  lon: number;
  capacityMw: number;
  commissioned?: number;
  owner?: string;
};

/**
 * Country outlines plus civil reactors: the only two fetched inputs behind the
 * alliance, base and nuclear layers. Alliance rosters and the base roster are
 * curated and already in the bundle, so they are not repeated here.
 */
export type AtlasPayload = {
  generatedAt: string;
  shapes: CountryShape[];
  nuclear: NuclearPlant[];
  attribution: string;
  attributionUrl: string;
  health: SourceHealth[];
};

/**
 * One OFAC programme reduced to arithmetic. The SDN list is 5.4 MB of CSV
 * carrying 243 programme tags; only the counts and the vessel records leave the
 * server, which is what keeps this channel in the low tens of kB.
 */
export type SanctionsProgram = {
  /** OFAC programme tag, e.g. "RUSSIA-EO14024". */
  tag: string;
  entities: number;
  individuals: number;
  vessels: number;
  aircraft: number;
};

/**
 * A designated vessel. NO POSITION, deliberately — none of these sources
 * publishes one, and inventing a coordinate for a designated tanker would be the
 * single most misleading thing this channel could do. The list is searchable and
 * keyed to IMO instead.
 */
export type DesignatedVessel = {
  /** IMO number where the source gives one, else the source's own id. */
  id: string;
  name: string;
  imo?: string;
  mmsi?: string;
  /** ISO 3166-1 alpha-2 as published. */
  flag?: string;
  /** Free text from OFAC ("Crude Oil Tanker"). */
  vesselType?: string;
  tonnage?: number;
  /** OFAC programme tags, or OpenSanctions dataset ids. */
  programs: string[];
  /** OpenSanctions risk tags: "sanction", "mare.shadow", "mare.detained". */
  risk: string[];
  /** Which upstream list this record came from. */
  listedBy: "OFAC" | "OpenSanctions";
};

/** One sanctions regime as the server reduced it, matching shared/sanctions.ts. */
export type SanctionsRegimeDigest = {
  id: string;
  name: string;
  short: string;
  authority: "UN" | "EU" | "US" | "GB" | "G7";
  measureClass: "comprehensive" | "broad-sectoral" | "sectoral" | "price-cap" | "arms-embargo" | "designated-entities";
  targets: string[];
  /** Aimed at territory the target state does not control; kept out of the fill. */
  territorial?: boolean;
  energy: boolean;
  sectors: string[];
  measureCount: number;
  suspendedCount: number;
  instrument: string;
  instrumentUrl: string;
  note: string;
  kind: "treaty" | "state-action" | "de-facto";
  confidence: "documented" | "reported";
  live: true;
  lastVerified: string;
};

/** Roster sizes per authority, so the panel can state how big each list is. */
export type DesignationTally = {
  authority: string;
  label: string;
  /** Publication date or generation stamp as the source states it. */
  publishedAt?: string;
  individuals?: number;
  entities?: number;
  vessels?: number;
  total: number;
  sourceUrl: string;
};

/**
 * Energy channel: pipelines and energy sites are curated and already in the
 * browser bundle, so the payload carries only what moves — the live regime list,
 * the programme arithmetic and the roster sizes.
 *
 * The vessel records are NOT here. They are 900 rows and were most of a 265 kB
 * payload on their own, and the map layer does not need one of them, so they have
 * their own route and are fetched only when the list is opened.
 */
export type EnergyPayload = {
  generatedAt: string;
  regimes: SanctionsRegimeDigest[];
  programs: SanctionsProgram[];
  /** Designated vessels available on /api/vessels. */
  vesselTotal: number;
  tallies: DesignationTally[];
  /** OFAC's own Publish_Date from the SDN list header, as MM/DD/YYYY. */
  ofacPublished?: string;
  attribution: string;
  attributionUrl: string;
  health: SourceHealth[];
};

/** The designated-vessel roster, fetched on demand. No positions, by design. */
export type VesselPayload = {
  generatedAt: string;
  vessels: DesignatedVessel[];
  /** Matches upstream before the cap, so the slice is never mistaken for the whole. */
  total: number;
  attribution: string;
  attributionUrl: string;
  health: SourceHealth[];
};

export type StrategicSignal = {
  id: string;
  iso3: string;
  class: StrategicSignalClass;
  title: string;
  summary: string;
  observedAt: string;
  source: string;
  sourceUrl: string;
  confidence: "documented" | "reported";
  origin: "documented" | "detected";
  active: boolean;
};

export type StrategicSignalsPayload = {
  generatedAt: string;
  signals: StrategicSignal[];
  health: SourceHealth[];
};
