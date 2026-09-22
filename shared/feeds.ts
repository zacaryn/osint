export type FeedCategory = "wire" | "gov" | "osint" | "defense" | "politics" | "regional";

export type FeedSource = {
  id: string;
  source: string;
  url: string;
  category: FeedCategory;
  /** Higher weight sources sort earlier when timestamps tie, and seed the breaking marquee. */
  weight: number;
};

export const CATEGORY_LABELS: Record<FeedCategory, string> = {
  wire: "Wire",
  gov: "Government",
  osint: "OSINT",
  defense: "Defense",
  politics: "Oversight",
  regional: "Regional",
};

/** Google News acts as a key-free RSS proxy for outlets that killed or firewalled their own feeds. */
function gnews(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
}

/**
 * Every feed below was probed live and returns parseable items without an API key.
 * Outlets whose native feeds are dead (CNN), firewalled (Politico, ISW) or removed
 * (CIA, ODNI, Senate Intel) are routed through the Google News proxy instead.
 */
export const FEEDS: FeedSource[] = [
  // Wires and breaking desks
  { id: "cnn", source: "CNN", url: gnews("site:cnn.com when:2d"), category: "wire", weight: 9 },
  { id: "bbc-breaking", source: "BBC", url: "https://feeds.bbci.co.uk/news/rss.xml", category: "wire", weight: 10 },
  { id: "bbc-world", source: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml", category: "wire", weight: 9 },
  { id: "bbc-me", source: "BBC Mid-East", url: "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml", category: "wire", weight: 8 },
  { id: "aljazeera", source: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", category: "wire", weight: 10 },
  { id: "reuters", source: "Reuters", url: gnews("site:reuters.com world when:2d"), category: "wire", weight: 10 },
  { id: "ap", source: "AP", url: gnews("site:apnews.com when:2d"), category: "wire", weight: 10 },
  { id: "guardian", source: "Guardian", url: "https://www.theguardian.com/world/rss", category: "wire", weight: 7 },
  { id: "nyt-world", source: "NYT World", url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", category: "wire", weight: 8 },
  { id: "npr-world", source: "NPR", url: "https://feeds.npr.org/1004/rss.xml", category: "wire", weight: 7 },
  { id: "france24", source: "France24", url: "https://www.france24.com/en/rss", category: "wire", weight: 7 },
  { id: "dw", source: "DW", url: "https://rss.dw.com/rdf/rss-en-world", category: "wire", weight: 7 },
  { id: "sky", source: "Sky News", url: "https://feeds.skynews.com/feeds/rss/world.xml", category: "wire", weight: 7 },

  // US government and multilateral bodies
  { id: "fbi", source: "FBI", url: "https://www.fbi.gov/feeds/national-press-releases/rss.xml", category: "gov", weight: 9 },
  { id: "cia", source: "CIA", url: gnews("site:cia.gov press release"), category: "gov", weight: 8 },
  { id: "odni", source: "ODNI", url: gnews("site:dni.gov"), category: "gov", weight: 9 },
  { id: "dod", source: "DoD", url: "https://www.defense.gov/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=945&max=20", category: "gov", weight: 9 },
  { id: "state", source: "State Dept", url: "https://www.state.gov/rss-feed/press-releases/feed/", category: "gov", weight: 8 },
  { id: "doj", source: "DOJ", url: "https://www.justice.gov/news/rss?type=press_release", category: "gov", weight: 8 },
  { id: "cisa", source: "CISA", url: "https://www.cisa.gov/cybersecurity-advisories/all.xml", category: "gov", weight: 8 },
  { id: "treasury", source: "Treasury / OFAC", url: gnews("site:treasury.gov sanctions"), category: "gov", weight: 8 },
  { id: "dhs", source: "DHS", url: gnews("site:dhs.gov"), category: "gov", weight: 6 },
  { id: "whitehouse", source: "White House", url: gnews("site:whitehouse.gov"), category: "gov", weight: 7 },
  { id: "fedreg", source: "Federal Register", url: "https://www.federalregister.gov/api/v1/documents.rss?conditions%5Bterm%5D=intelligence", category: "gov", weight: 5 },
  { id: "gao", source: "GAO", url: "https://www.gao.gov/rss/reports.xml", category: "gov", weight: 6 },
  { id: "un", source: "UN News", url: "https://news.un.org/feed/subscribe/en/news/all/rss.xml", category: "gov", weight: 7 },
  { id: "nato", source: "NATO", url: gnews("site:nato.int OR NATO statement allied"), category: "gov", weight: 8 },
  { id: "euvsdisinfo", source: "EUvsDisinfo", url: "https://euvsdisinfo.eu/feed/", category: "gov", weight: 5 },

  // Congressional oversight
  { id: "senate-intel", source: "Senate Intel", url: gnews("site:intelligence.senate.gov"), category: "politics", weight: 8 },
  { id: "house-intel", source: "House Intel", url: gnews("House Intelligence Committee"), category: "politics", weight: 7 },
  { id: "politico", source: "Politico", url: gnews("site:politico.com congress OR defense"), category: "politics", weight: 7 },
  { id: "thehill", source: "The Hill", url: "https://thehill.com/news/feed/", category: "politics", weight: 6 },
  { id: "rollcall", source: "Roll Call", url: "https://rollcall.com/feed/", category: "politics", weight: 5 },
  { id: "congress", source: "Congress", url: gnews("Senate OR House armed services intelligence hearing"), category: "politics", weight: 5 },

  // OSINT and research institutions
  { id: "isw", source: "ISW", url: gnews("site:understandingwar.org"), category: "osint", weight: 10 },
  { id: "bellingcat", source: "Bellingcat", url: "https://www.bellingcat.com/feed/", category: "osint", weight: 9 },
  { id: "lwj", source: "Long War Journal", url: "https://www.longwarjournal.org/feed", category: "osint", weight: 8 },
  { id: "criticalthreats", source: "Critical Threats", url: gnews("site:criticalthreats.org"), category: "osint", weight: 8 },
  { id: "lawfare", source: "Lawfare", url: "https://www.lawfaremedia.org/feeds/articles", category: "osint", weight: 7 },
  { id: "wotr", source: "War on the Rocks", url: "https://warontherocks.com/feed/", category: "osint", weight: 7 },
  { id: "jamestown", source: "Jamestown", url: "https://jamestown.org/feed/", category: "osint", weight: 6 },
  { id: "atlanticcouncil", source: "Atlantic Council", url: "https://www.atlanticcouncil.org/feed/", category: "osint", weight: 6 },
  { id: "rand", source: "RAND", url: "https://www.rand.org/news/press.xml", category: "osint", weight: 6 },
  { id: "intelnews", source: "intelNews", url: "https://intelnews.org/feed/", category: "osint", weight: 6 },
  { id: "38north", source: "38 North", url: "https://www.38north.org/feed/", category: "osint", weight: 7 },

  // Defense trade press
  { id: "defenseone", source: "Defense One", url: "https://www.defenseone.com/rss/all/", category: "defense", weight: 8 },
  { id: "breakingdefense", source: "Breaking Defense", url: "https://breakingdefense.com/feed/", category: "defense", weight: 7 },
  { id: "twz", source: "The War Zone", url: "https://www.twz.com/feed", category: "defense", weight: 8 },
  { id: "navalnews", source: "Naval News", url: "https://www.navalnews.com/feed/", category: "defense", weight: 7 },
  { id: "defensenews", source: "Defense News", url: "https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml", category: "defense", weight: 7 },
  { id: "militarytimes", source: "Military Times", url: "https://www.militarytimes.com/arc/outboundfeeds/rss/?outputType=xml", category: "defense", weight: 6 },
  { id: "aviationist", source: "Aviationist", url: "https://theaviationist.com/feed/", category: "defense", weight: 6 },

  // Regional conflict desks
  { id: "kyiv", source: "Kyiv Independent", url: gnews("site:kyivindependent.com when:2d"), category: "regional", weight: 8 },
  { id: "meduza", source: "Meduza", url: "https://meduza.io/rss/en/all", category: "regional", weight: 7 },
  { id: "moscowtimes", source: "Moscow Times", url: "https://www.themoscowtimes.com/rss/news", category: "regional", weight: 6 },
  { id: "toi", source: "Times of Israel", url: "https://www.timesofisrael.com/feed/", category: "regional", weight: 7 },
  { id: "scmp", source: "SCMP", url: "https://www.scmp.com/rss/91/feed", category: "regional", weight: 6 },
  { id: "taipei", source: "Taipei Times", url: "https://www.taipeitimes.com/xml/index.rss", category: "regional", weight: 6 },
  { id: "yonhap", source: "Yonhap", url: "https://en.yna.co.kr/RSS/news.xml", category: "regional", weight: 7 },

  // Western Hemisphere security
  { id: "insightcrime", source: "InSight Crime", url: "https://insightcrime.org/feed/", category: "regional", weight: 8 },
  { id: "borderlandbeat", source: "Borderland Beat", url: "https://www.borderlandbeat.com/feeds/posts/default", category: "regional", weight: 6 },
  { id: "southcom", source: "SOUTHCOM", url: gnews("site:southcom.mil OR US Southern Command"), category: "gov", weight: 7 },
  { id: "mexico-security", source: "Mexico security", url: gnews("Mexico violence cartel fentanyl when:3d"), category: "regional", weight: 7 },
  { id: "panama-canal", source: "Panama Canal", url: gnews("Panama Canal transit restrictions drought"), category: "regional", weight: 6 },
  { id: "venezuela-desk", source: "Venezuela", url: gnews("Venezuela Guyana Essequibo military"), category: "regional", weight: 7 },
  { id: "uk-mod", source: "UK MoD", url: gnews("site:gov.uk Ministry of Defence statement"), category: "gov", weight: 7 },

  // Theater desks (keyword routing via shared/zones.ts)
  { id: "eu-east", source: "NATO eastern flank", url: gnews("NATO Baltic Poland Belarus Kaliningrad when:3d"), category: "regional", weight: 7 },
  { id: "centcom", source: "CENTCOM", url: gnews("site:centcom.mil OR US Central Command when:5d"), category: "gov", weight: 8 },
  { id: "redsea-shipping", source: "Red Sea shipping", url: gnews("Red Sea Houthi vessel attack shipping when:3d"), category: "regional", weight: 8 },
  { id: "hormuz-desk", source: "Hormuz desk", url: gnews("Strait of Hormuz tanker IRGC seizure when:3d"), category: "regional", weight: 8 },
  { id: "indopac-desk", source: "Indo-Pacific desk", url: gnews("Taiwan ADIZ OR \"South China Sea\" Philippines military when:2d"), category: "regional", weight: 8 },
  { id: "nk-desk", source: "DPRK desk", url: gnews("North Korea missile launch ballistic when:5d"), category: "regional", weight: 8 },
  { id: "sahel-desk", source: "Sahel security", url: gnews("Mali OR Niger OR Burkina Faso coup jihadist when:3d"), category: "regional", weight: 7 },
  { id: "caucasus-desk", source: "Caucasus", url: gnews("Armenia Azerbaijan border clash military when:3d"), category: "regional", weight: 7 },
  { id: "kashmir-desk", source: "Kashmir / LOC", url: gnews("Kashmir line of control India Pakistan strike when:3d"), category: "regional", weight: 7 },
  { id: "africom", source: "AFRICOM", url: gnews("site:africom.mil OR US Africa Command when:5d"), category: "gov", weight: 6 },
  { id: "maritime-desk", source: "Maritime security", url: gnews("site:maritime-executive.com OR Lloyd's List shipping war risk when:5d"), category: "defense", weight: 7 },
  { id: "nuclear-desk", source: "Nuclear signals", url: gnews("nuclear test ICBM strategic forces readiness when:5d"), category: "regional", weight: 7 },
];
