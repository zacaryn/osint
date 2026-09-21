/**
 * Alliance membership joined to country outlines by ISO A3.
 *
 * Draw order matters and is deliberate: non-member tiers go down first as
 * outlines, then the membership signatures on top as hatched fills, then the
 * rhetorical labels last. That way an aspirant's dashed border is visible beside a
 * member's hatch and never under it, and a phrase from a speech never acquires a
 * territory.
 */
import L from "leaflet";
import { useMemo } from "react";
import { LayerGroup, Marker, Polygon, Polyline, Popup, Tooltip } from "react-leaflet";
import { allianceById } from "@shared/alliance-registry";
import { overlapCells, tierCells, type Alliance, type MemberTier } from "@shared/alliances";
import { countryName } from "@shared/flags";
import type { CountryShape } from "@shared/types";
import OverlapPatterns from "./OverlapPatterns";
import AlliancePopup from "./AlliancePopup";
import { anchorOf, cellPaint, cellPattern, hasFill, ringsOf, tierPaint } from "./alliance-paint";

const OUTLINE_TIERS: MemberTier[] = ["partner", "aspirant", "suspended"];

/**
 * A spoke drawn the short way round. Without this, Washington to Tokyo is
 * rendered eastward across the Atlantic and Eurasia, which is both wrong and
 * covers half the map.
 */
function shortWay(from: [number, number], to: [number, number]): [number, number] {
  const shift = to[1] - from[1] > 180 ? -360 : to[1] - from[1] < -180 ? 360 : 0;
  return [to[0], to[1] + shift];
}

export default function AllianceLayer({
  selected,
  shapes,
}: {
  selected: Alliance[];
  shapes: CountryShape[];
}) {
  const byIso = useMemo(() => new Map(shapes.map((s) => [s.i, s])), [shapes]);

  const filled = useMemo(() => selected.filter((a) => hasFill(a.pactClass)), [selected]);
  const outlineOnly = useMemo(() => selected.filter((a) => a.pactClass === "security-partnership"), [selected]);
  const annotated = useMemo(() => selected.filter((a) => a.pactClass === "rhetorical"), [selected]);

  const cells = useMemo(() => overlapCells(filled), [filled]);
  const patterns = useMemo(() => cells.map(cellPattern), [cells]);

  /** One outline per (grouping, tier) pair that is not a full member of a filled class. */
  const outlines = useMemo(() => {
    const rows: { alliance: Alliance; tier: MemberTier; iso3s: string[] }[] = [];
    for (const tier of OUTLINE_TIERS) {
      for (const cell of tierCells(selected, tier)) rows.push({ ...cell, tier });
    }
    for (const alliance of outlineOnly) {
      rows.push({
        alliance,
        tier: "member",
        iso3s: alliance.members.filter((m) => m.tier === "member").map((m) => m.iso3),
      });
    }
    return rows;
  }, [selected, outlineOnly]);

  return (
    <LayerGroup>
      <OverlapPatterns specs={patterns} />

      {outlines.map(({ alliance, tier, iso3s }) => {
        const paint = tierPaint(alliance, tier);
        if (!paint) return null;
        return iso3s.map((iso3) => {
          const shape = byIso.get(iso3);
          if (!shape) return null;
          return (
            <Polygon
              key={`${alliance.id}-${tier}-${iso3}`}
              positions={ringsOf(shape)}
              pathOptions={{
                color: paint.color,
                weight: paint.weight,
                dashArray: paint.dashArray,
                fillColor: paint.color,
                fillOpacity: paint.fillOpacity,
                interactive: false,
              }}
            />
          );
        });
      })}

      {cells.map((cell) => {
        const paint = cellPaint(cell);
        const labels = cell.ids.map((id) => allianceById(id)?.short ?? id);
        return cell.iso3s.map((iso3) => {
          const shape = byIso.get(iso3);
          if (!shape) return null;
          return (
            <Polygon
              key={`${cell.key}-${iso3}`}
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
              <Popup maxWidth={320} minWidth={240} autoPanPaddingTopLeft={[10, 64]}>
                <AlliancePopup iso3={iso3} />
              </Popup>
            </Polygon>
          );
        });
      })}

      {/*
        Hub-and-spokes is drawn as spokes because that is what it is. Japan and
        South Korea owe each other nothing under these treaties, and a single
        filled region would invent an alliance between them.
      */}
      {selected
        .filter((a) => a.topology === "hub-and-spoke" && a.hub)
        .map((alliance) => {
          const hubShape = byIso.get(alliance.hub as string);
          if (!hubShape) return null;
          const hub = anchorOf(hubShape);
          return alliance.members
            .filter((m) => m.tier === "member" && m.iso3 !== alliance.hub)
            .map((member) => {
              const shape = byIso.get(member.iso3);
              if (!shape) return null;
              return (
                <Polyline
                  key={`spoke-${alliance.id}-${member.iso3}`}
                  positions={[hub, shortWay(hub, anchorOf(shape))]}
                  pathOptions={{ color: alliance.color, weight: 1.6, dashArray: "8 4", interactive: false }}
                />
              );
            });
        })}

      {annotated.map((alliance) =>
        alliance.members
          .filter((m) => m.tier === "member")
          .map((member) => {
            const shape = byIso.get(member.iso3);
            if (!shape) return null;
            const year = alliance.signed?.slice(0, 4) ?? "";
            return (
              <Marker
                key={`${alliance.id}-${member.iso3}`}
                position={anchorOf(shape)}
                interactive={false}
                keyboard={false}
                icon={L.divIcon({
                  className: "",
                  iconSize: [0, 0],
                  html: `<span class="alrhet mono" style="--al:${alliance.color}">${alliance.short}${
                    year ? ` ${year}` : ""
                  }</span>`,
                })}
              />
            );
          }),
      )}
    </LayerGroup>
  );
}
