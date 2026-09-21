/**
 * Strategic military installations: a square in the operator's flag colour, a
 * single mono glyph for the branch, and a dimmed strike-through for anything
 * closed or withdrawn.
 *
 * Square rather than round because every other marker on this board is, and
 * because the operator hue has to read at 11 px — the analytical question is whose
 * forces are where, so flag colour leads and branch follows.
 */
import L from "leaflet";
import { LayerGroup, Marker, Popup } from "react-leaflet";
import {
  BRANCH_GLYPH,
  operatorColor,
  type MilitaryBase,
} from "@shared/military-bases";
import BasePopup from "./BasePopup";
import { rgba } from "./paint";

function iconFor(base: MilitaryBase): L.DivIcon {
  const color = operatorColor(base);
  const state = base.status === "closed" ? "is-closed" : base.status === "active" ? "" : "is-tentative";
  return L.divIcon({
    className: "",
    iconSize: [0, 0],
    html: `<span class="bpin ${state}" style="--bs:${color};--bs-fill:${rgba(color, 0.3)}">
             <i class="bpin__glyph mono">${BRANCH_GLYPH[base.branch]}</i>
           </span>`,
  });
}

export default function BaseLayer({ bases }: { bases: MilitaryBase[] }) {
  return (
    <LayerGroup>
      {bases.map((base) => (
        <Marker
          key={base.id}
          position={[base.lat, base.lon]}
          icon={iconFor(base)}
          zIndexOffset={400}
          title={`${base.name} — ${base.operator} ${base.branch}, ${base.status}`}
          alt={`${base.name} military installation`}
        >
          <Popup maxWidth={320} minWidth={240} autoPanPaddingTopLeft={[10, 64]}>
            <BasePopup base={base} />
          </Popup>
        </Marker>
      ))}
    </LayerGroup>
  );
}
