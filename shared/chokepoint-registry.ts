/**
 * Curated access status for the passages that matter operationally.
 *
 * Rules this file is held to:
 *  - Every restriction names a real instrument or a reported act, plus a date.
 *  - Anything this board cannot confirm is still in force is marked
 *    confidence: "reported" and says so in its note.
 *  - Standing treaty law that simply defines normal transit belongs in
 *    `baseline`, not in `restrictions`. A booking queue or a draft limit is not
 *    a restriction on who may transit.
 *  - `portwatchId` is absent where IMF PortWatch has no matching polygon.
 */
import type { ChokepointStatus } from "./chokepoints.ts";
import type { Zone } from "./zones.ts";

const EIA = "EIA, World Oil Transit Chokepoints";

export const CHOKEPOINTS: ChokepointStatus[] = [
  {
    id: "hormuz",
    name: "Strait of Hormuz",
    short: "Hormuz",
    // Mid-channel off Ras Musandam. Kept clear of the Hormuz tripwire anchor in
    // shared/watchlists.ts so the two markers do not land on the same pixel.
    lat: 26.45,
    lon: 56.42,
    zone: "hormuz",
    regime: "unclos-transit",
    baseline:
      "Transit passage for all flags under UNCLOS Art. 37–44. Iran signed but never ratified UNCLOS and argues transit passage is owed only to parties, reserving a right to regulate the strait.",
    throughput: { value: 20.9, unit: "mmbd", source: EIA, asOf: "2023-12-31" },
    portwatchId: "chokepoint6",
    query:
      '("Strait of Hormuz" OR Hormuz) (tanker OR closure OR seizure OR mine OR escort OR IRGC OR blocked OR jamming)',
    match: ["hormuz", "persian gulf", "gulf of oman", "bandar abbas"],
    restrictions: [
      {
        restrictionId: "hormuz-transit-collapse",
        targets: ["*"],
        scope: "all",
        severity: "closed",
        layer: "standing",
        imposedBy: "Iran (IRGCN)",
        basis: "IMF PortWatch transits fell from ~78/day in Feb 2026 to ~4/day from Mar 2026 and have not recovered in the six months since; the IRGC states publicly that it retains control of the strait",
        since: "2026-03-01",
        note: "Not a declared closure. A residual few vessels a day still pass, reportedly under Iranian clearance and transit tolls, and Iran has struck at least one tanker inside the strait. Short pauses for specific flags or convoys can sit on top of this row — use infrastructure overlays when PortWatch or primary maritime sources show a temporary reopening without lifting the broader regime.",
        kind: "de-facto",
        confidence: "reported",
        sourceUrl: "https://portwatch.imf.org/",
      },
      {
        restrictionId: "hormuz-isr-us-gbr-tankers",
        targets: ["ISR", "USA", "GBR"],
        scope: "tanker",
        severity: "denied",
        layer: "standing",
        imposedBy: "Iran (IRGCN)",
        basis: "Repeated IRGC Navy seizures of Israel-, US- and UK-linked tankers — Advantage Sweet (Apr 2023), St Nikolas (Jan 2024), MSC Aries (Apr 2024)",
        since: "2023-04-27",
        note: "Layered on the general transit collapse: even when some neutral traffic moves, ownership or charterer linkage to these states is what draws a boarding. A few-week allowance for specific traffic does not erase this row unless primary sources document a formal lift.",
        kind: "de-facto",
        confidence: "documented",
      },
    ],
  },
  {
    id: "bab-al-mandab",
    name: "Bab al-Mandab",
    short: "Bab al-Mandab",
    lat: 12.58,
    lon: 43.33,
    zone: "bab",
    regime: "unclos-transit",
    baseline:
      "Transit passage for all flags under UNCLOS. No coastal state asserts a right to bar transit; the constraint here is a non-state actor with anti-ship missiles.",
    throughput: { value: 8.7, unit: "mmbd", source: EIA, asOf: "2023-12-31" },
    portwatchId: "chokepoint4",
    query:
      '("Bab al-Mandab" OR "Bab el-Mandeb" OR "Red Sea") shipping (attack OR Houthi OR rerouting OR transit OR insurance OR missile OR drone)',
    match: ["bab al-mandab", "bab el-mandeb", "mandeb", "red sea", "gulf of aden", "houthi", "yemen"],
    restrictions: [
      {
        restrictionId: "bab-war-risk-advisory",
        targets: ["*"],
        scope: "all",
        severity: "advisory",
        layer: "standing",
        imposedBy: "Joint War Committee / UKMTO",
        basis: "Southern Red Sea and Gulf of Aden listed as a war-risk area following the November 2023 attack campaign",
        since: "2023-11-19",
        note: "Most operators still route around the Cape rather than accept the premium. The transit-count trend on this board is the live measure of that choice.",
        kind: "de-facto",
        confidence: "documented",
      },
      {
        restrictionId: "bab-houthi-isr",
        targets: ["ISR"],
        scope: "commercial",
        severity: "denied",
        layer: "standing",
        imposedBy: "Houthi forces (Ansar Allah)",
        basis: "Declared campaign against Israel-linked shipping, opened with the seizure of Galaxy Leader on 19 Nov 2023",
        since: "2023-11-19",
        note: "Vessels sunk include Rubymar (Mar 2024), Tutor (Jun 2024), Magic Seas and Eternity C (Jul 2025). Ceasefire-linked pauses have reduced attack tempo for weeks at a time without withdrawing the declared policy — treat headline lulls as temporary overlays, not as clearance for all traffic.",
        kind: "de-facto",
        confidence: "reported",
      },
      {
        restrictionId: "bab-houthi-us-gbr",
        targets: ["USA", "GBR"],
        scope: "commercial",
        severity: "denied",
        layer: "standing",
        imposedBy: "Houthi forces (Ansar Allah)",
        basis: "Declared extension of the campaign to US- and UK-linked vessels after the January 2024 coalition strikes",
        since: "2024-01-12",
        note: "Targeting keys on ownership, operator and port history rather than flag, and has repeatedly caught vessels with no actual connection. US–Houthi understandings reported in press cycles may narrow risk for some operators temporarily; broader non-US/UK/ISR traffic can still face advisory-level risk.",
        kind: "de-facto",
        confidence: "reported",
      },
    ],
  },
  {
    id: "suez",
    name: "Suez Canal",
    short: "Suez",
    lat: 30.4,
    lon: 32.35,
    zone: "bab",
    regime: "canal-convention",
    baseline:
      "Free to vessels of commerce and of war of every flag, in time of war as in peace, and never subject to blockade — Convention of Constantinople, 1888. Egypt has not restricted transit; the canal's problem is upstream at Bab al-Mandab.",
    throughput: { value: 9.2, unit: "mmbd", source: EIA, asOf: "2023-12-31" },
    portwatchId: "chokepoint1",
    query: '"Suez Canal" (transit OR traffic OR convoy OR reroute OR revenue OR tolls OR discount)',
    match: ["suez"],
    restrictions: [],
  },
  {
    id: "bosphorus",
    name: "Bosphorus & Dardanelles",
    short: "Turkish Straits",
    lat: 41.12,
    lon: 29.06,
    zone: "ukraine",
    regime: "montreux",
    baseline:
      "Free merchant transit in peacetime. Warships are limited by tonnage, class and prior notice, and non-Black Sea powers additionally by aggregate tonnage and a 21-day stay — Montreux Convention Arts. 11–18.",
    throughput: { value: 3.0, unit: "mmbd", source: EIA, asOf: "2023-12-31" },
    portwatchId: "chokepoint3",
    query:
      '(Bosphorus OR Bosporus OR Dardanelles OR "Turkish Straits") (warship OR tanker OR shipping OR transit OR Montreux OR closure OR queue OR grain)',
    // "Montreux" is deliberately absent from the anchor group and from match:
    // on its own it pulls in the Swiss town's festival listings.
    match: ["bosphorus", "bosporus", "dardanelles", "turkish strait", "montreux convention", "istanbul strait"],
    restrictions: [
      {
        targets: ["RUS", "UKR"],
        scope: "warship",
        severity: "denied",
        imposedBy: "Türkiye",
        basis: "Montreux Convention Art. 19 — belligerent warships barred from the Straits",
        since: "2022-02-28",
        note: "Invoked once Türkiye formally recognised a state of war. Art. 19 preserves one exception: a belligerent warship may return to its home base.",
        kind: "treaty",
        confidence: "documented",
      },
    ],
  },
  {
    id: "malacca",
    name: "Strait of Malacca",
    short: "Malacca",
    // Offset from the Malacca tripwire anchor for the same reason.
    lat: 2.85,
    lon: 100.75,
    zone: "indopacific",
    regime: "unclos-transit",
    baseline:
      "Transit passage under UNCLOS, with a traffic separation scheme run jointly by Indonesia, Malaysia and Singapore. The binding limit is physical: roughly 25 m draft and 1.5 nm width at the narrowest point.",
    throughput: { value: 23.7, unit: "mmbd", source: EIA, asOf: "2023-12-31" },
    portwatchId: "chokepoint5",
    query:
      '("Strait of Malacca" OR "Malacca Strait") (shipping OR tanker OR piracy OR blockade OR congestion OR navy OR transit OR collision)',
    match: ["malacca"],
    restrictions: [],
  },
  {
    id: "singapore",
    name: "Singapore Strait",
    short: "Singapore Str.",
    lat: 1.23,
    lon: 103.85,
    zone: "indopacific",
    regime: "unclos-transit",
    baseline:
      "Transit passage under UNCLOS within the Singapore Strait traffic separation scheme. No state restricts transit.",
    // PortWatch folds this into its Malacca polygon, so there is no separate series.
    query:
      '("Singapore Strait" OR "Phillip Channel" OR ReCAAP) (robbery OR boarding OR piracy OR incident OR tanker OR crew OR congestion)',
    match: ["singapore", "phillip channel", "recaap"],
    restrictions: [
      {
        targets: ["*"],
        scope: "commercial",
        severity: "advisory",
        imposedBy: "Criminal groups (non-state)",
        basis: "ReCAAP ISC reporting of sustained armed robbery against ships in the eastbound lane, at record levels through 2024–2025",
        since: "2024-01-01",
        note: "Almost all incidents are opportunistic night boardings of underway bulkers and tankers for stores or scrap, not hijackings. Transit is unaffected; crews are not.",
        kind: "de-facto",
        confidence: "documented",
      },
    ],
  },
  {
    id: "taiwan",
    name: "Taiwan Strait",
    short: "Taiwan Str.",
    lat: 24.5,
    lon: 119.5,
    zone: "indopacific",
    regime: "contested",
    baseline:
      "At roughly 90 nm the strait is wider than two 12 nm territorial seas, so a corridor of high seas and EEZ runs its length where high-seas freedoms apply. The PRC rejects that reading and asserts sovereign rights over the whole strait.",
    portwatchId: "chokepoint11",
    query:
      '"Taiwan Strait" (blockade OR quarantine OR transit OR closure OR drill OR PLA OR exercise OR median line)',
    match: ["taiwan"],
    restrictions: [
      {
        targets: ["*"],
        scope: "warship",
        severity: "advisory",
        imposedBy: "China (PLA)",
        basis: "PRC position, stated publicly in June 2022, that the Taiwan Strait is not international waters; routine PLA shadowing and formal protest of foreign warship transits",
        since: "2022-06-13",
        note: "No transit has actually been denied. The dispute is over whether transit is a right or a courtesy, which is why the regime itself is classed as contested rather than the passage as restricted.",
        kind: "de-facto",
        confidence: "documented",
      },
    ],
  },
  {
    id: "luzon",
    name: "Luzon Strait / Bashi Channel",
    short: "Luzon",
    lat: 21.0,
    lon: 121.0,
    zone: "indopacific",
    regime: "unclos-transit",
    baseline:
      "High seas and EEZ passage between Taiwan and the Philippines, and the PLA Navy's main route from the South China Sea into the Philippine Sea. No state restricts transit.",
    portwatchId: "chokepoint14",
    query:
      '("Bashi Channel" OR "Luzon Strait" OR "Balintang Channel") (PLA OR Taiwan OR navy OR transit OR drill OR submarine OR "first island chain" OR missile)',
    match: ["bashi", "luzon", "balintang", "batanes", "first island chain"],
    restrictions: [],
  },
  {
    id: "panama",
    name: "Panama Canal",
    short: "Panama",
    lat: 9.12,
    lon: -79.77,
    zone: "americas",
    regime: "canal-convention",
    baseline:
      "Permanently neutral and open to peaceful transit by vessels of all nations on equal terms — Torrijos–Carter Neutrality Treaty, 1977. Daily slots are auctioned and maximum draft tracks the Gatun Lake level, so capacity moves with rainfall without any flag being excluded.",
    throughput: { value: 36, unit: "transits/day", source: "Panama Canal Authority booking capacity", asOf: "2024-06-30" },
    portwatchId: "chokepoint2",
    query: '"Panama Canal" (restrictions OR draft OR slots OR transit OR tolls OR treaty OR drought OR Gatun)',
    match: ["panama", "gatun"],
    restrictions: [],
  },
  {
    id: "magellan",
    name: "Strait of Magellan",
    short: "Magellan",
    lat: -52.6,
    lon: -69.6,
    zone: "americas",
    regime: "unclos-transit",
    baseline:
      "High-seas passage at the southern tip of South America; Chile and Argentina regulate pilotage and weather windows but do not bar peaceful transit.",
    portwatchId: "chokepoint21",
    query: '"Strait of Magellan" (transit OR LNG OR tanker OR closure OR weather OR pilot)',
    match: ["magellan", "punta arenas", "patagonia"],
    restrictions: [],
  },
  {
    id: "yucatan-channel",
    name: "Yucatan Channel",
    short: "Yucatán",
    lat: 21.8,
    lon: -85.6,
    zone: "americas",
    regime: "unclos-transit",
    baseline: "Open passage between the Gulf of Mexico and the Caribbean; no coastal state asserts a transit bar.",
    portwatchId: "chokepoint22",
    query: '"Yucatan Channel" (transit OR tanker OR hurricane OR closure OR naval)',
    match: ["yucatan channel", "yucatán channel", "cancun", "cozumel"],
    restrictions: [],
  },
  {
    id: "windward-passage",
    name: "Windward Passage",
    short: "Windward",
    lat: 20.0,
    lon: -73.7,
    zone: "americas",
    regime: "unclos-transit",
    baseline: "Transit between the Atlantic and the Caribbean past Cuba and Hispaniola; routine container and tanker route.",
    portwatchId: "chokepoint23",
    query: '"Windward Passage" (transit OR tanker OR naval OR Cuba OR Haiti)',
    match: ["windward passage", "guantanamo", "haiti strait"],
    restrictions: [],
  },
  {
    id: "mona-passage",
    name: "Mona Passage",
    short: "Mona",
    lat: 18.45,
    lon: -67.7,
    zone: "americas",
    regime: "unclos-transit",
    baseline: "Passage between Puerto Rico and Hispaniola; heavy ferry and coastal traffic, no standing transit ban.",
    portwatchId: "chokepoint24",
    query: '"Mona Passage" (transit OR migrant OR interdiction OR naval OR Dominican)',
    match: ["mona passage", "mona island", "mayaguez"],
    restrictions: [],
  },
  {
    id: "gibraltar",
    name: "Strait of Gibraltar",
    short: "Gibraltar",
    lat: 35.94,
    lon: -5.75,
    regime: "unclos-transit",
    baseline:
      "Transit passage under UNCLOS Art. 37–44, which cannot be suspended. Spain and Morocco border the strait; the extent of British Gibraltar territorial waters is disputed by Spain.",
    portwatchId: "chokepoint8",
    query:
      '("Strait of Gibraltar" OR Gibraltar) (transit OR detained OR tanker OR naval OR "shadow fleet" OR bunkering OR submarine)',
    match: ["gibraltar", "algeciras", "ceuta", "tangier"],
    restrictions: [
      {
        targets: ["RUS"],
        scope: "flagged",
        severity: "conditional",
        imposedBy: "European Union / United Kingdom",
        basis: "Council Regulation 833/2014 as amended by the 5th sanctions package — port-access ban for Russian-flagged vessels",
        since: "2022-04-08",
        note: "Transit passage through the strait is untouched and cannot lawfully be suspended. What is barred is calling at EU or UK ports, which in practice removes bunkering and repair along the route.",
        kind: "state-action",
        confidence: "documented",
      },
    ],
  },
  {
    id: "danish-straits",
    name: "Danish Straits",
    short: "Danish Straits",
    lat: 55.8,
    lon: 11.5,
    zone: "ukraine",
    regime: "treaty-strait",
    baseline:
      "Free passage through the Great Belt, Little Belt and Oresund, guaranteed by the 1857 Copenhagen Convention which abolished the Sound Dues. Denmark recommends but cannot compel pilotage, and cannot levy dues or bar transit.",
    throughput: { value: 3.2, unit: "mmbd", source: EIA, asOf: "2023-12-31" },
    // PortWatch covers only the Oresund, not the Great Belt, which carries the deep-draft tankers.
    portwatchId: "chokepoint10",
    query:
      '("Danish Straits" OR "Great Belt" OR Oresund OR Kattegat OR Skagerrak OR "Baltic Sea") ("shadow fleet" OR tanker OR inspection OR detained OR insurance OR sabotage OR cable)',
    match: [
      "danish strait",
      "great belt",
      "oresund",
      "øresund",
      "kattegat",
      "skagerrak",
      "baltic",
      "denmark",
      "danish",
      "shadow fleet",
    ],
    restrictions: [
      {
        targets: ["RUS"],
        scope: "tanker",
        severity: "advisory",
        imposedBy: "Denmark and Baltic coastal states",
        basis: "Coordinated challenges for proof of P&I insurance from tankers transiting the straits, alongside EU designation of shadow-fleet vessels",
        since: "2025-01-01",
        note: "Deliberately short of interdiction: the 1857 Convention leaves no ground to bar transit, so states query insurance and flag registration instead. Treat the exact scope as moving — this board cannot confirm the current posture.",
        kind: "state-action",
        confidence: "reported",
      },
      {
        targets: ["RUS"],
        scope: "flagged",
        severity: "conditional",
        imposedBy: "European Union",
        basis: "Council Regulation 833/2014 as amended — port-access ban for Russian-flagged vessels",
        since: "2022-04-08",
        note: "Bars port calls, not passage. Russian-flagged and designated vessels still transit to and from Primorsk and Ust-Luga.",
        kind: "state-action",
        confidence: "documented",
      },
    ],
  },
  {
    id: "kerch",
    name: "Kerch Strait",
    short: "Kerch",
    lat: 45.27,
    lon: 36.54,
    zone: "ukraine",
    regime: "internal-waters",
    baseline:
      "The 2003 Russia–Ukraine treaty made the Sea of Azov and Kerch Strait shared internal waters with free access for both states. Russia has held both shores since 2014 and now regulates transit unilaterally; Ukraine disputes this and won an ITLOS jurisdictional ruling in 2019.",
    portwatchId: "chokepoint28",
    query:
      '("Kerch Strait" OR "Crimean Bridge" OR "Sea of Azov") (shipping OR attack OR closed OR blockade OR strike OR tanker OR bridge)',
    match: ["kerch", "azov", "crimean bridge", "crimea bridge"],
    restrictions: [
      {
        targets: ["*"],
        scope: "all",
        severity: "conditional",
        imposedBy: "Russia",
        basis: "Unilateral Russian control of both shores and of the bridge's navigable span since 2014; transit requires Russian clearance",
        since: "2014-03-18",
        note: "The 2018 bridge physically caps air draft at 33 m, permanently excluding larger vessels from Azov ports regardless of clearance.",
        kind: "de-facto",
        confidence: "documented",
      },
      {
        targets: ["UKR"],
        scope: "all",
        severity: "closed",
        imposedBy: "Russia",
        basis: "De facto closure to Ukrainian traffic after the November 2018 Kerch incident and total closure following the February 2022 invasion",
        since: "2022-02-24",
        note: "Ukraine's Azov ports, Berdyansk and Mariupol, have had no commercial access since. ITLOS ordered the release of the 2018 detained crews in 2019.",
        kind: "de-facto",
        confidence: "documented",
      },
      {
        targets: ["RUS"],
        scope: "commercial",
        severity: "denied",
        imposedBy: "Ukraine",
        basis: "Ukrainian navigational warning of 5 July 2023 declaring Russian Black Sea ports and their approaches a war-risk area",
        since: "2023-07-05",
        note: "Issued in reply to Russia's own warning after it left the grain initiative. Ukrainian USVs have since struck shipping and the bridge itself, so the declaration has teeth even though Ukraine cannot police the strait.",
        kind: "state-action",
        confidence: "documented",
      },
    ],
  },
  {
    id: "nsr",
    name: "Northern Sea Route",
    short: "Northern Sea Rt.",
    lat: 75.5,
    lon: 105.0,
    regime: "internal-waters",
    baseline:
      "Russia draws straight baselines across the Vilkitsky, Shokalsky, Dmitry Laptev and Sannikov straits and treats the water inside as internal, requiring permission, pilotage and icebreaker escort. The United States and others reject the claim and assert transit passage.",
    // PortWatch has no Northern Sea Route polygon; Bering Strait is a different passage.
    query:
      '"Northern Sea Route" (transit OR escort OR icebreaker OR sanctions OR closed OR permit OR LNG OR Arctic shipping)',
    match: ["northern sea route", "arctic", "icebreaker", "vilkitsky", "yamal"],
    restrictions: [
      {
        targets: ["*"],
        scope: "all",
        severity: "conditional",
        imposedBy: "Russia (Northern Sea Route Administration / Rosatom)",
        basis: "Permit regime under the 2012 federal NSR law and the Merchant Shipping Code, justified by UNCLOS Art. 234 on ice-covered areas",
        since: "2013-01-01",
        note: "Transit is available in practice and routinely granted to Chinese and Russian operators, but on Russian terms, with Russian escort, and at Russian prices.",
        kind: "state-action",
        confidence: "documented",
      },
    ],
  },
  {
    id: "good-hope",
    name: "Cape of Good Hope",
    short: "Cape",
    lat: -34.93,
    lon: 20.88,
    regime: "unclos-transit",
    baseline:
      "High seas rounding with no coastal-state transit control. Included because it is the reroute of record: when the Red Sea is unusable, traffic appears here instead, which makes it the control case for the Suez and Bab al-Mandab trend.",
    portwatchId: "chokepoint7",
    query:
      '("Cape of Good Hope" OR "Cape route") (shipping OR tanker OR container OR reroute OR diversion OR transit OR bunkering)',
    // "round Africa" / "around Africa" catch the reroute stories that never name the Cape.
    match: [
      "good hope",
      "cape route",
      "cape town",
      "south africa",
      "southern africa",
      "durban",
      "round africa",
      "around africa",
    ],
    restrictions: [],
  },
];

export function chokepointById(id: string): ChokepointStatus | undefined {
  return CHOKEPOINTS.find((c) => c.id === id);
}

/**
 * A passage belongs to a zone when it is tagged to it or simply falls inside
 * its box. The tag carries the cases the boxes miss — the Turkish Straits sit
 * just outside both the Ukraine and Middle East rectangles but belong with
 * Russia's Black Sea access.
 */
export function chokepointsForZone(zone: Zone): ChokepointStatus[] {
  const [south, west, north, east] = zone.bbox;
  return CHOKEPOINTS.filter(
    (c) => c.zone === zone.id || (c.lat >= south && c.lat <= north && c.lon >= west && c.lon <= east),
  );
}
