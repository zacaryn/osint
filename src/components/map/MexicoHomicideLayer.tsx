import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { GeoJSON, LayerGroup } from "react-leaflet";
import {
  MEXICO_HOMICIDE_SOURCE,
  MEXICO_HOMICIDE_STATES,
  MEXICO_HOMICIDE_YEAR,
} from "@shared/mexico-homicide";
import { rateChoroplethStyle } from "./overlap-paint";

type GeoProps = { name?: string };
type GeoFeature = { type: string; properties?: GeoProps; geometry: unknown };
type GeoCollection = { type: string; features: GeoFeature[] };

function normName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

export default function MexicoHomicideLayer() {
  const [geo, setGeo] = useState<GeoCollection | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/mexico/geojson")
      .then((r) => r.json())
      .then((body) => {
        if (!cancelled) setGeo(body as GeoCollection);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const byName = useMemo(() => {
    const map = new Map<string, (typeof MEXICO_HOMICIDE_STATES)[number]>();
    for (const row of MEXICO_HOMICIDE_STATES) map.set(normName(row.name), row);
    return map;
  }, []);

  const maxRate = useMemo(
    () => Math.max(...MEXICO_HOMICIDE_STATES.map((s) => s.ratePer100k), 1),
    [],
  );

  if (!geo) return null;

  const style = (feature?: GeoFeature) => {
    const name = feature?.properties?.name ?? "";
    const row = byName.get(normName(name));
    const rate = row?.ratePer100k ?? 0;
    const paint = rateChoroplethStyle(rate, maxRate);
    return { ...paint, weight: 1.2 };
  };

  const onEach = (feature: GeoFeature, layer: L.Layer) => {
    const name = feature.properties?.name ?? "";
    const row = byName.get(normName(name));
    if (!row) return;
    layer.bindPopup(
      `<strong>${name}</strong><br/>${row.homicides.toLocaleString()} homicides (${MEXICO_HOMICIDE_YEAR})<br/>${row.ratePer100k} per 100k<br/><span class="popup__meta">${MEXICO_HOMICIDE_SOURCE}</span>`,
    );
  };

  return (
    <LayerGroup>
      <GeoJSON data={geo as never} style={style} onEachFeature={onEach} />
    </LayerGroup>
  );
}
