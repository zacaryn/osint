/**
 * The shadow fleet, from OpenSanctions' maritime collection.
 *
 * LICENCE: CC-BY-NC. Free for this non-commercial dashboard and labelled as such
 * wherever the data is shown. The OpenSanctions *API* requires a key and returns
 * 401; only the bulk files are open. Never fetch the `default` collection — its
 * nested targets file is 3.7 GB and its statements CSV is 9.0 GB.
 *
 * THE DATASET IS NOT ALL SANCTIONS. Measured, the 23,365 rows are dominated by
 * port-state control detentions: `tokyo_mou_detention` alone is 5,924 and has
 * nothing to do with designation. So rows are kept only on the `sanction` or
 * `mare.shadow` risk tags, which is what turns a mixed maritime-risk file into a
 * designated-and-shadow-fleet roster.
 *
 * NO POSITIONS. This source has none, and neither does any other designation
 * list. Scattering 900 tankers across the oceans at plausible-looking coordinates
 * would be the most dishonest thing this phase could ship, so the vessels are a
 * searchable list keyed on IMO and flag, exactly as Phase 1 recommended.
 */
import { CACHE_MS } from "../../shared/cadence.ts";
import { iso3FromIso2 } from "../../shared/flags.ts";
import type { DesignatedVessel } from "../../shared/types.ts";
import { cached } from "../cache.ts";
import { csvIndex, splitCsvLine } from "../csv.ts";
import { fetchText } from "../http.ts";

const SOURCE = "https://data.opensanctions.org/datasets/latest/maritime/maritime.csv";

export const SHADOW_ATTRIBUTION = "OpenSanctions maritime collection (CC-BY-NC)";
export const SHADOW_URL = "https://www.opensanctions.org/datasets/maritime/";

/** Risk tags worth a place on this board. Detention alone is not one. */
const KEPT_RISK = ["sanction", "mare.shadow"];

export type ShadowDigest = {
  vessels: DesignatedVessel[];
  /** Matches before the cap, so the panel can say what it is showing a slice of. */
  matched: number;
  rows: number;
  /** Row count per contributing list, for the per-authority tallies. */
  byDataset: Record<string, number>;
};

/**
 * Cap on what crosses the wire. 900 records at roughly 70 bytes is about 60 kB
 * uncompressed and a quarter of that over the wire, which is the most a
 * searchable list can justify; the total is reported alongside so the slice is
 * never mistaken for the whole.
 */
const CAP = 900;

export async function loadShadowFleet(): Promise<ShadowDigest> {
  return cached("shadow-fleet", CACHE_MS.shadowFleet, async () => {
    const res = await fetchText(SOURCE, 45000);
    if (!res.ok) throw new Error(`HTTP ${res.status} maritime.csv`);

    const lines = res.text.split(/\r?\n/);
    const at = csvIndex(lines[0] ?? "");
    if (at.imo === undefined || at.risk === undefined) throw new Error("maritime.csv columns changed");

    const vessels: DesignatedVessel[] = [];
    const byDataset: Record<string, number> = {};
    let matched = 0;

    for (let i = 1; i < lines.length; i += 1) {
      if (!lines[i].trim()) continue;
      const row = splitCsvLine(lines[i]);
      if (row[at.type] !== "VESSEL") continue;

      const risk = (row[at.risk] ?? "").split(";").filter(Boolean);
      if (!risk.some((r) => KEPT_RISK.includes(r))) continue;

      const datasets = (row[at.datasets] ?? "").split(";").filter(Boolean);
      for (const d of datasets) byDataset[d] = (byDataset[d] ?? 0) + 1;

      matched += 1;

      const name = row[at.caption]?.trim();
      const id = row[at.id]?.trim();
      if (!name || !id) continue;

      vessels.push({
        id,
        name,
        imo: row[at.imo]?.replace(/^IMO/, "") || undefined,
        mmsi: row[at.mmsi] || undefined,
        // OpenSanctions writes lowercase ISO2; the board speaks ISO3 everywhere else.
        flag: iso3FromIso2(row[at.flag] ?? "") ?? undefined,
        programs: datasets,
        risk,
        listedBy: "OpenSanctions",
      });
    }

    if (matched === 0) throw new Error("maritime.csv matched no designated vessels");

    // Shadow-fleet tankers first, then anything carrying an IMO — the cap has to
    // fall on the least identifiable records, not on whatever came last in the file.
    vessels.sort((a, b) => {
      const shadow = Number(b.risk.includes("mare.shadow")) - Number(a.risk.includes("mare.shadow"));
      const identified = Number(Boolean(b.imo)) - Number(Boolean(a.imo));
      return shadow || identified || a.name.localeCompare(b.name);
    });

    return { vessels: vessels.slice(0, CAP), matched, rows: lines.length - 1, byDataset };
  });
}
