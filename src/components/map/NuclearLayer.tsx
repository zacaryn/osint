/**
 * Nuclear sites: civil power stations from the WRI Global Power Plant Database,
 * plus a small curated set of weapons-complex sites rendered distinctly.
 *
 * The two never share a marker shape. A reactor is a diamond sized by capacity; a
 * weapons site is a square with a doubled border and says "curated" in its popup.
 * The civil list is auditable row by row against a published CSV; the weapons list
 * is this board's own selection, and the reader is told which is which.
 */
import L from "leaflet";
import { LayerGroup, Marker, Popup } from "react-leaflet";
import { WEAPONS_FUNCTION_LABEL, type WeaponsSite } from "@shared/nuclear-sites";
import { countryName } from "@shared/flags";
import type { NuclearPlant } from "@shared/types";
import { rgba } from "./paint";

const CIVIL = "#a98bff";
const WEAPONS = "#ff4d4d";

/** 8 px at a research reactor, 16 px at Kashiwazaki-Kariwa. */
function sizeFor(capacityMw: number): number {
  return Math.round(Math.min(16, Math.max(8, 8 + Math.sqrt(capacityMw) / 22)));
}

function plantIcon(plant: NuclearPlant): L.DivIcon {
  const size = sizeFor(plant.capacityMw);
  return L.divIcon({
    className: "",
    iconSize: [0, 0],
    html: `<span class="npin" style="--np:${CIVIL};--np-fill:${rgba(
      CIVIL,
      0.34,
    )};--np-size:${size}px"></span>`,
  });
}

const weaponsIcon = L.divIcon({
  className: "",
  iconSize: [0, 0],
  html: `<span class="npin npin--weapons" style="--np:${WEAPONS};--np-fill:${rgba(WEAPONS, 0.26)}"></span>`,
});

export default function NuclearLayer({
  plants,
  sites,
}: {
  plants: NuclearPlant[];
  sites: WeaponsSite[];
}) {
  return (
    <LayerGroup>
      {plants.map((plant) => (
        <Marker
          key={plant.id}
          position={[plant.lat, plant.lon]}
          icon={plantIcon(plant)}
          zIndexOffset={300}
          title={`${plant.name} — ${plant.capacityMw} MW civil reactor, ${countryName(plant.country)}`}
          alt={`${plant.name} nuclear power station`}
        >
          <Popup maxWidth={300} minWidth={220} autoPanPaddingTopLeft={[10, 64]}>
            <div className="npop">
              <span className="popup__title">{plant.name}</span>
              <div className="npop__kind mono">Civil nuclear power station</div>
              <div className="npop__stat">
                <b>{plant.capacityMw.toLocaleString()} MW</b> · {countryName(plant.country)}
                {plant.commissioned ? ` · commissioned ${plant.commissioned}` : ""}
              </div>
              {plant.owner && <div className="cpop__meta mono">operator {plant.owner}</div>}
              {/*
                GPPD is a snapshot, not a register. Germany's fleet is shut and
                Zaporizhzhia is occupied and in cold shutdown, yet both are
                carried upstream at full nameplate capacity.
              */}
              <div className="npop__caveat">
                Nameplate capacity from a periodic snapshot, not a live register. A plant listed here may be shut down,
                idled or under occupation.
              </div>
              <div className="cpop__meta mono">
                WRI Global Power Plant Database (CC-BY 4.0) ·{" "}
                <a href="https://datasets.wri.org/dataset/globalpowerplantdatabase" target="_blank" rel="noreferrer">
                  source
                </a>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      {sites.map((site) => (
        <Marker
          key={site.id}
          position={[site.lat, site.lon]}
          icon={weaponsIcon}
          zIndexOffset={350}
          title={`${site.name} — ${WEAPONS_FUNCTION_LABEL[site.function]}, ${countryName(site.country)}`}
          alt={`${site.name} nuclear weapons complex site`}
        >
          <Popup maxWidth={320} minWidth={240} autoPanPaddingTopLeft={[10, 64]}>
            <div className="npop">
              <span className="popup__title">{site.name}</span>
              <div className="npop__kind mono" data-weapons="true">
                Curated — nuclear weapons complex
              </div>
              <div className="npop__stat">
                {WEAPONS_FUNCTION_LABEL[site.function]} · {site.status} · {countryName(site.country)}
              </div>
              <p className="bpop__role">{site.detail}</p>
              {site.confidence === "reported" && (
                <div className="cpop__note">
                  <span className="cpop__flag">reported — not independently confirmed</span>
                </div>
              )}
              <div className="cpop__meta mono">
                {site.source} ·{" "}
                <a href={site.sourceUrl} target="_blank" rel="noreferrer">
                  source
                </a>{" "}
                · curated, last verified {site.lastVerified}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </LayerGroup>
  );
}
