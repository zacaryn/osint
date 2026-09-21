/**
 * OFAC's SDN list, reduced to programme arithmetic and vessel records.
 *
 * PAYLOAD DISCIPLINE IS THE WHOLE DESIGN HERE. Upstream is 19,393 entries. None
 * of them are served. What leaves this module is a count per programme for the 18
 * energy-relevant tags plus the vessel records, because a designated tanker is a
 * thing this board can say something about and a designated individual is not.
 *
 * FORMAT CHOICE. The XML is 27.8 MB; the CSV is 5.4 MB and carries the same
 * fields this needs — type, programme, call sign, vessel type, tonnage, flag and
 * owner. So the CSV is parsed for content and a 3 kB HTTP Range request against
 * the XML picks up the `Publish_Date` header, which the CSV does not carry.
 * Measured: 2.9 kB and 292 ms for the date against 27.8 MB for the same fact.
 * (The recent-actions RSS that used to carry it 404s; do not go looking for it.)
 *
 * The programme field is delimited by "] [" inside a single quoted CSV column,
 * not by commas or semicolons, and OFAC writes "-0-" where other lists write an
 * empty field. Both are load-bearing and neither is documented.
 */
import { CACHE_MS } from "../../shared/cadence.ts";
import { iso3FromName } from "../../shared/flags.ts";
import { ENERGY_OFAC_PROGRAMS } from "../../shared/sanctions.ts";
import type { DesignatedVessel, SanctionsProgram } from "../../shared/types.ts";
import { cached } from "../cache.ts";
import { splitCsvLine } from "../csv.ts";
import { fetchText } from "../http.ts";

const BASE = "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports";
const CSV_URL = `${BASE}/SDN.CSV`;
const XML_URL = `${BASE}/SDN.XML`;

export const OFAC_ATTRIBUTION = "US Treasury OFAC Specially Designated Nationals list (public domain)";
export const OFAC_URL = "https://sanctionslist.ofac.treas.gov/Home/SdnList";

/** Column order of SDN.CSV, which has no header row. */
const COL = {
  entNum: 0,
  name: 1,
  type: 2,
  program: 3,
  title: 4,
  callSign: 5,
  vesselType: 6,
  tonnage: 7,
  grt: 8,
  flag: 9,
  owner: 10,
  remarks: 11,
} as const;

const NULL_FIELD = "-0-";

function field(row: string[], at: number): string | undefined {
  const raw = row[at]?.trim();
  return !raw || raw === NULL_FIELD ? undefined : raw;
}

function programsOf(row: string[]): string[] {
  const raw = field(row, COL.program);
  if (!raw) return [];
  return raw
    .split(/\]\s*\[/)
    .map((p) => p.replace(/^\[|\]$/g, "").trim())
    .filter(Boolean);
}

export type OfacDigest = {
  programs: SanctionsProgram[];
  vessels: DesignatedVessel[];
  /** Row count, so the panel can state how much was reduced away. */
  entries: number;
  publishedAt?: string;
};

/** 3 kB of a 27.8 MB file: OFAC honours Range, which makes the date nearly free. */
async function publishDate(): Promise<string | undefined> {
  const res = await fetchText(XML_URL, 12000, { Range: "bytes=0-3000" });
  if (!res.ok && res.status !== 206) return undefined;
  return /<Publish_Date>([^<]+)<\/Publish_Date>/.exec(res.text)?.[1];
}

export async function loadOfacDigest(): Promise<OfacDigest> {
  return cached("ofac-sdn", CACHE_MS.sanctionsDigest, async () => {
    const [csv, published] = await Promise.all([fetchText(CSV_URL, 45000), publishDate()]);
    if (!csv.ok) throw new Error(`HTTP ${csv.status} SDN.CSV`);

    const lines = csv.text.split(/\r?\n/);
    const wanted = new Set<string>(ENERGY_OFAC_PROGRAMS);
    const tally = new Map<string, SanctionsProgram>();
    const vessels: DesignatedVessel[] = [];
    let entries = 0;

    for (const line of lines) {
      if (!line.trim()) continue;
      const row = splitCsvLine(line);
      if (row.length < 12) continue;
      entries += 1;

      // OFAC writes "-0-" in the type column for entities rather than naming them.
      const type = field(row, COL.type) ?? "entity";
      const programs = programsOf(row);

      for (const tag of programs) {
        if (!wanted.has(tag)) continue;
        const at = tally.get(tag) ?? { tag, entities: 0, individuals: 0, vessels: 0, aircraft: 0 };
        if (type === "individual") at.individuals += 1;
        else if (type === "vessel") at.vessels += 1;
        else if (type === "aircraft") at.aircraft += 1;
        else at.entities += 1;
        tally.set(tag, at);
      }

      if (type !== "vessel") continue;
      const name = field(row, COL.name);
      if (!name) continue;
      const grt = field(row, COL.grt);
      const flag = field(row, COL.flag);
      vessels.push({
        id: `ofac-${row[COL.entNum]?.trim() ?? name}`,
        name,
        // OFAC publishes the registry as a name; everything else here is ISO3.
        flag: flag && flag !== "None Identified" ? iso3FromName(flag) : undefined,
        vesselType: field(row, COL.vesselType),
        tonnage: grt ? Number.parseInt(grt.replace(/\D/g, ""), 10) || undefined : undefined,
        programs,
        risk: ["sanction"],
        listedBy: "OFAC",
      });
    }

    if (entries === 0) throw new Error("SDN.CSV parsed to zero rows");

    // The roster is capped downstream, so energy designations have to sort above
    // the rest or a Cuban harbour tug displaces a designated crude tanker.
    vessels.sort((a, b) => {
      const energy =
        Number(b.programs.some((p) => wanted.has(p))) - Number(a.programs.some((p) => wanted.has(p)));
      return energy || (b.tonnage ?? 0) - (a.tonnage ?? 0) || a.name.localeCompare(b.name);
    });

    return {
      programs: [...tally.values()].sort(
        (a, b) =>
          b.entities + b.individuals + b.vessels + b.aircraft - (a.entities + a.individuals + a.vessels + a.aircraft),
      ),
      vessels,
      entries,
      publishedAt: published,
    };
  });
}
