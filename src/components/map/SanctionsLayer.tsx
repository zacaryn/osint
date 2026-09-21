/**
 * Sanctions regimes joined to country outlines by ISO A3.
 *
 * Structurally the same layer as AllianceLayer, and deliberately so — it shares
 * the pattern machinery in ./overlap-paint and the SVG paint servers in
 * ./OverlapPatterns rather than growing a parallel set. The only thing specific to
 * sanctions is what a signature is made of: measure classes, not regimes.
 */
import { useMemo } from "react";
import { LayerGroup, Polygon, Popup, Tooltip } from "react-leaflet";
import { MEASURE_CLASS_LABEL, type MeasureClass, type SanctionsRegime } from "@shared/sanctions";
import { countryName } from "@shared/flags";
import type { CountryShape } from "@shared/types";
import OverlapPatterns from "./OverlapPatterns";
import SanctionsPopup from "./SanctionsPopup";
import { ringsOf } from "./overlap-paint";
import { cellClasses, sanctionsCells, sanctionsPaint, sanctionsPattern } from "./sanctions-paint";

export default function SanctionsLayer({
  regimes,
  shapes,
}: {
  regimes: SanctionsRegime[];
  shapes: CountryShape[];
}) {
  const byIso = useMemo(() => new Map(shapes.map((s) => [s.i, s])), [shapes]);
  const cells = useMemo(() => sanctionsCells(regimes), [regimes]);
  const patterns = useMemo(() => cells.map(sanctionsPattern), [cells]);

  return (
    <LayerGroup>
      <OverlapPatterns specs={patterns} />

      {cells.map((cell) => {
        const paint = sanctionsPaint(cell);
        const labels = cellClasses(cell).map((c: MeasureClass) => MEASURE_CLASS_LABEL[c]);
        return cell.iso3s.map((iso3) => {
          const shape = byIso.get(iso3);
          if (!shape) return null;
          return (
            <Polygon
              key={`sx-${cell.key}-${iso3}`}
              positions={ringsOf(shape)}
              pathOptions={{
                color: paint.stroke,
                weight: paint.weight,
                fillColor: `url(#${paint.patternId})`,
                fillOpacity: 1,
              }}
            >
              <Tooltip sticky>
                <b>{countryName(iso3)}</b> — {labels.join(" + ")}
              </Tooltip>
              <Popup maxWidth={340} minWidth={260} autoPanPaddingTopLeft={[10, 64]}>
                <SanctionsPopup iso3={iso3} regimes={regimes} />
              </Popup>
            </Polygon>
          );
        });
      })}
    </LayerGroup>
  );
}
