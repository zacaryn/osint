// Probes candidate RSS/Atom feeds and reports which are usable without keys.
// Usage: node scripts/check-feeds.mjs
import Parser from "rss-parser";

const CANDIDATES = [
  // --- Wires / breaking ---
  ["wire", "CNN Top", "http://rss.cnn.com/rss/cnn_topstories.rss"],
  ["wire", "CNN World", "http://rss.cnn.com/rss/cnn_world.rss"],
  ["wire", "CNN US", "http://rss.cnn.com/rss/cnn_us.rss"],
  ["wire", "BBC World", "https://feeds.bbci.co.uk/news/world/rss.xml"],
  ["wire", "BBC Breaking", "https://feeds.bbci.co.uk/news/rss.xml"],
  ["wire", "BBC MidEast", "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml"],
  ["wire", "Al Jazeera", "https://www.aljazeera.com/xml/rss/all.xml"],
  ["wire", "Guardian World", "https://www.theguardian.com/world/rss"],
  ["wire", "France24", "https://www.france24.com/en/rss"],
  ["wire", "DW World", "https://rss.dw.com/rdf/rss-en-world"],
  ["wire", "NPR World", "https://feeds.npr.org/1004/rss.xml"],
  ["wire", "NYT World", "https://rss.nytimes.com/services/xml/rss/nyt/World.xml"],
  ["wire", "WaPo World", "http://feeds.washingtonpost.com/rss/world"],
  ["wire", "Reuters World", "https://news.google.com/rss/search?q=site:reuters.com+world&hl=en-US&gl=US&ceid=US:en"],
  ["wire", "AP Top", "https://news.google.com/rss/search?q=site:apnews.com&hl=en-US&gl=US&ceid=US:en"],
  ["wire", "Sky News World", "https://feeds.skynews.com/feeds/rss/world.xml"],

  // --- US government / official ---
  ["gov", "FBI Press", "https://www.fbi.gov/feeds/national-press-releases/rss.xml"],
  ["gov", "FBI Wanted", "https://www.fbi.gov/wanted/rss.xml"],
  ["gov", "CIA News", "https://www.cia.gov/news-stories/feed/"],
  ["gov", "ODNI", "https://www.dni.gov/index.php/newsroom/press-releases?format=feed&type=rss"],
  ["gov", "DoD News", "https://www.defense.gov/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=945&max=20"],
  ["gov", "State Dept", "https://www.state.gov/rss-feed/press-releases/feed/"],
  ["gov", "Treasury Press", "https://home.treasury.gov/news/press-releases/feed"],
  // OFAC's recent-actions RSS was retired and 404s. The publication date now has
  // to be read from the SDN list header — server/sources/sanctions-ofac.ts does it
  // with a 3 kB HTTP Range request. Do not re-add the RSS URL.
  ["gov", "OFAC SDN publish date", "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.CSV"],
  ["gov", "CISA Advisories", "https://www.cisa.gov/cybersecurity-advisories/all.xml"],
  ["gov", "DHS News", "https://www.dhs.gov/news-releases/releases.xml"],
  ["gov", "DOJ National Security", "https://www.justice.gov/news/rss?type=press_release"],
  ["gov", "White House", "https://www.whitehouse.gov/feed/"],
  ["gov", "GAO Reports", "https://www.gao.gov/rss/reports.xml"],
  ["gov", "Senate Intel Cmte", "https://www.intelligence.senate.gov/rss.xml"],
  ["gov", "Congress Bills", "https://www.congress.gov/rss/most-viewed-bills.xml"],
  ["gov", "Federal Register Intel", "https://www.federalregister.gov/api/v1/documents.rss?conditions%5Bterm%5D=intelligence"],
  ["gov", "NATO News", "https://www.nato.int/cps/en/natohq/news.rss"],
  ["gov", "UN News", "https://news.un.org/feed/subscribe/en/news/all/rss.xml"],
  ["gov", "EUvsDisinfo", "https://euvsdisinfo.eu/feed/"],

  // --- OSINT / think tanks ---
  ["osint", "Bellingcat", "https://www.bellingcat.com/feed/"],
  ["osint", "ISW", "https://www.understandingwar.org/rss.xml"],
  ["osint", "Long War Journal", "https://www.longwarjournal.org/feed"],
  ["osint", "Jamestown", "https://jamestown.org/feed/"],
  ["osint", "CSIS", "https://www.csis.org/analysis/feed"],
  ["osint", "Atlantic Council", "https://www.atlanticcouncil.org/feed/"],
  ["osint", "RAND", "https://www.rand.org/news/press.xml"],
  ["osint", "Lawfare", "https://www.lawfaremedia.org/feeds/articles"],
  ["osint", "War on the Rocks", "https://warontherocks.com/feed/"],
  ["osint", "CFR", "https://www.cfr.org/rss.xml"],
  ["osint", "Carnegie", "https://carnegieendowment.org/rss/pubs"],
  ["osint", "Brookings", "https://www.brookings.edu/feed/"],
  ["osint", "FPRI", "https://www.fpri.org/feed/"],
  ["osint", "Grey Dynamics", "https://greydynamics.com/feed/"],
  ["osint", "Intel News", "https://intelnews.org/feed/"],

  // --- Defense / military trade ---
  ["defense", "Defense One", "https://www.defenseone.com/rss/all/"],
  ["defense", "Breaking Defense", "https://breakingdefense.com/feed/"],
  ["defense", "The War Zone", "https://www.twz.com/feed"],
  ["defense", "Naval News", "https://www.navalnews.com/feed/"],
  ["defense", "Janes", "https://www.janes.com/feeds/news"],
  ["defense", "Military Times", "https://www.militarytimes.com/arc/outboundfeeds/rss/?outputType=xml"],
  ["defense", "Stars and Stripes", "https://www.stripes.com/rss/news.rss"],
  ["defense", "Defense News", "https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml"],
  ["defense", "Aviationist", "https://theaviationist.com/feed/"],
  ["defense", "Army Recognition", "https://armyrecognition.com/rss.xml"],

  // --- Politics / oversight ---
  ["politics", "Politico Congress", "https://www.politico.com/rss/congress.xml"],
  ["politics", "Politico Defense", "https://www.politico.com/rss/defense.xml"],
  ["politics", "The Hill", "https://thehill.com/news/feed/"],
  ["politics", "Roll Call", "https://rollcall.com/feed/"],

  // --- Regional conflict desks ---
  ["regional", "Kyiv Independent", "https://kyivindependent.com/feed/"],
  ["regional", "Times of Israel", "https://www.timesofisrael.com/feed/"],
  ["regional", "Moscow Times", "https://www.themoscowtimes.com/rss/news"],
  ["regional", "Meduza EN", "https://meduza.io/rss/en/all"],
  ["regional", "SCMP China", "https://www.scmp.com/rss/91/feed"],
  ["regional", "Al Arabiya", "https://english.alarabiya.net/tools/rss"],
  ["regional", "Taipei Times", "https://www.taipeitimes.com/xml/index.rss"],
  ["regional", "Yonhap", "https://en.yna.co.kr/RSS/news.xml"],
];

const parser = new Parser({
  timeout: 14000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    Accept: "application/rss+xml, application/xml, text/xml, application/atom+xml, */*",
  },
});

async function probe([category, name, url]) {
  const started = Date.now();
  try {
    const feed = await parser.parseURL(url);
    const items = feed.items ?? [];
    const newest = items[0]?.isoDate ?? items[0]?.pubDate ?? "";
    return { ok: items.length > 0, category, name, url, count: items.length, newest, ms: Date.now() - started };
  } catch (err) {
    return { ok: false, category, name, url, error: String(err.message ?? err).slice(0, 90), ms: Date.now() - started };
  }
}

async function pool(items, size, fn) {
  const out = [];
  let i = 0;
  const workers = Array.from({ length: size }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

const results = await pool(CANDIDATES, 10, probe);
const good = results.filter((r) => r.ok);
const bad = results.filter((r) => !r.ok);

console.log(`\n=== WORKING (${good.length}/${results.length}) ===`);
for (const r of good) {
  console.log(`OK   [${r.category}] ${r.name} :: ${r.count} items :: ${r.newest} :: ${r.url}`);
}
console.log(`\n=== FAILED (${bad.length}) ===`);
for (const r of bad) {
  console.log(`FAIL [${r.category}] ${r.name} :: ${r.error ?? "0 items"} :: ${r.url}`);
}
