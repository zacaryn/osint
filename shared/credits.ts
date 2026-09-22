/**
 * Attribution for upstream data, tiles, and services.
 * Shown in the Credits panel — keep in sync when adding server/sources/*.ts fetchers.
 */

export type CreditEntry = {
  name: string;
  url?: string;
  note: string;
};

export type CreditSection = {
  id: string;
  title: string;
  intro?: string;
  items: CreditEntry[];
};

export const CREDITS_INTRO =
  "OSINT Watch aggregates free, keyless public feeds and open datasets. This board is an independent viewer, not affiliated with the publishers below. Headlines and posts link to original outlets; verify before acting.";

export const CREDIT_SECTIONS: CreditSection[] = [
  {
    id: "news",
    title: "News wire & tripwires",
    intro:
      "RSS and Google News search proxies (no API key). Tripwires, chokepoint headlines, pipeline watches, and strategic-signal detection use the same Google News RSS pattern.",
    items: [
      {
        name: "Google News RSS",
        url: "https://news.google.com/",
        note: "Search-backed RSS for outlets without working native feeds and for theater-specific queries.",
      },
      {
        name: "Publisher RSS feeds",
        note: "Direct feeds where available — BBC, Al Jazeera, NYT World, NPR, Guardian, DoD, State Dept, Bellingcat, ISW (via search), defense press, and regional desks. Full list: shared/feeds.ts in the repository.",
      },
    ],
  },
  {
    id: "social",
    title: "X (Twitter) monitor deck",
    items: [
      {
        name: "FxTwitter / FixTweet API",
        url: "https://github.com/FixTweet/FxTwitter",
        note: "Public timeline embedding used to load monitored accounts (configurable via FXTWITTER_BASE_URL). Posts remain © their authors and X Corp.",
      },
      {
        name: "Default monitor roster",
        note: "Independent OSINT desks, wire accounts, and command press offices tagged by theater in shared/accounts.ts. Users may add or remove handles locally.",
      },
    ],
  },
  {
    id: "maritime",
    title: "Maritime & energy infrastructure",
    items: [
      {
        name: "IMF PortWatch",
        url: "https://portwatch.imf.org/",
        note: "Daily chokepoint transit counts (ArcGIS FeatureServer). Data runs ~1 week behind; ratios are per-chokepoint only.",
      },
      {
        name: "U.S. Energy Information Administration",
        url: "https://www.eia.gov/",
        note: "Throughput figures cited on chokepoint popups (World Oil Transit Chokepoints).",
      },
      {
        name: "OpenInfraMap",
        url: "https://openinframap.org/",
        note: "OpenStreetMap-derived petroleum pipeline vector tiles (optional layer).",
      },
      {
        name: "OpenStreetMap",
        url: "https://www.openstreetmap.org/copyright",
        note: "Street basemap tiles and OSM pipeline geometry via OpenInfraMap.",
      },
    ],
  },
  {
    id: "conflict",
    title: "Conflict geometry & hazards",
    items: [
      {
        name: "DeepStateMap",
        url: "https://deepstatemap.live/",
        note: "Ukraine territorial control polygons and front markers (community map; terms on site).",
      },
      {
        name: "U.S. Geological Survey Earthquake Hazards",
        url: "https://earthquake.usgs.gov/",
        note: "M2.5+ weekly feed and specialized explosion/nuclear-event query.",
      },
      {
        name: "GDACS",
        url: "https://www.gdacs.org/",
        note: "Global disaster alert and coordination system event list.",
      },
      {
        name: "NASA EONET",
        url: "https://eonet.gsfc.nasa.gov/",
        note: "Open natural event metadata.",
      },
      {
        name: "NOAA National Hurricane Center",
        url: "https://www.nhc.noaa.gov/",
        note: "Current storm positions (JSON).",
      },
      {
        name: "USGS Volcano Hazards",
        url: "https://volcanoes.usgs.gov/",
        note: "Elevated volcano API.",
      },
      {
        name: "NASA FIRMS (VIIRS)",
        url: "https://firms.modaps.eosdis.nasa.gov/",
        note: "Hotspot detections when MAPS_KEY is configured server-side.",
      },
      {
        name: "NASA Spot The Station",
        url: "https://spotthestation.nasa.gov/",
        note: "ISS sighting opportunities (public page).",
      },
    ],
  },
  {
    id: "aviation",
    title: "Aviation",
    items: [
      {
        name: "OpenSky Network",
        url: "https://opensky-network.org/",
        note: "ADS-B state vectors in the current map bounding box (optional layer; credentials improve rate limits).",
      },
    ],
  },
  {
    id: "sanctions",
    title: "Sanctions & designated vessels",
    items: [
      {
        name: "U.S. Treasury OFAC",
        url: "https://sanctionslist.ofac.treas.gov/",
        note: "SDN publication exports — reduced server-side to programme-level counts.",
      },
      {
        name: "EU Sanctions Map",
        url: "https://www.sanctionsmap.eu/",
        note: "Restrictive measures regimes API.",
      },
      {
        name: "OpenSanctions",
        url: "https://www.opensanctions.org/",
        note: "Maritime / shadow-fleet CSV dataset.",
      },
      {
        name: "UN Security Council Consolidated List",
        url: "https://scsanctions.un.org/",
        note: "XML consolidated sanctions list.",
      },
      {
        name: "UK OFSI",
        url: "https://www.gov.uk/government/organisations/office-of-financial-sanctions-implementation",
        note: "Consolidated list CSV export.",
      },
      {
        name: "European Commission FSF",
        url: "https://webgate.ec.europa.eu/fsd/fsf/",
        note: "Full sanctions list XML (EU).",
      },
    ],
  },
  {
    id: "geo",
    title: "Map basemaps & geography",
    items: [
      {
        name: "Esri ArcGIS Online",
        url: "https://www.esri.com/",
        note: "World Imagery, Dark Gray Canvas, and reference layers (default dark basemap).",
      },
      {
        name: "NASA GIBS",
        url: "https://www.earthdata.nasa.gov/",
        note: "VIIRS true-color and Black Marble night imagery WMTS.",
      },
      {
        name: "world.geo.json / Natural Earth",
        url: "https://github.com/johan/world.geo.json",
        note: "Country outlines for alliance and sanctions fills (filtered and simplified server-side).",
      },
      {
        name: "OpenStreetMap Nominatim",
        url: "https://nominatim.openstreetmap.org/",
        note: "Place search in the header jump bar (usage policy applies).",
      },
      {
        name: "World Resources Institute — Global Power Plant Database",
        url: "https://datasets.wri.org/dataset/globalpowerplantdatabase",
        note: "Civil nuclear / power plant coordinates (filtered to nuclear entries).",
      },
    ],
  },
  {
    id: "curated",
    title: "Curated in this repository",
    intro:
      "Maintained by the OSINT Watch contributors, not fetched live. Each entry carries last-verified dates in UI where shown.",
    items: [
      {
        name: "Chokepoint access registry",
        note: "Legal regimes, restrictions, PortWatch ids — shared/chokepoint-registry.ts.",
      },
      {
        name: "Pipeline registry & Gulf geometry",
        note: "Status lines and polylines — shared/pipeline-registry.ts and regional pipeline files.",
      },
      {
        name: "Alliance & pact rosters",
        note: "NATO, EU, BRICS framing, etc. — shared/alliance-registry.ts.",
      },
      {
        name: "Military bases & conflict gazetteer",
        note: "Installations and geocodable flashpoints — shared/base-registry.ts, shared/gazetteer.ts.",
      },
      {
        name: "Precedent baselines",
        note: "Historical recurrence bands (CSIS, 38 North, NATO press, etc. cited per row) — shared/precedent-registry.ts.",
      },
      {
        name: "Infrastructure overlays",
        note: "Editorial status overrides — data/infrastructure-overlays.json.",
      },
      {
        name: "Reactive language & OSINT triage",
        note: "Deterministic headline rules — shared/reactive-language.ts.",
      },
    ],
  },
  {
    id: "software",
    title: "Software",
    items: [
      {
        name: "Leaflet",
        url: "https://leafletjs.com/",
        note: "Map rendering.",
      },
      {
        name: "React",
        url: "https://react.dev/",
        note: "UI.",
      },
      {
        name: "Open source license",
        note: "Application source is published under the repository LICENSE; upstream datasets retain their own terms.",
      },
    ],
  },
];
