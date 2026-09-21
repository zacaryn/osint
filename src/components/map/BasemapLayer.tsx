import { TileLayer } from "react-leaflet";
import { gibsDate } from "../../time";
import type { Basemap } from "./layers";

export default function BasemapLayer({ basemap }: { basemap: Basemap }) {
  const date = gibsDate(1);

  if (basemap === "imagery") {
    return (
      <TileLayer
        attribution="Esri, Maxar, Earthstar Geographics"
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      />
    );
  }

  if (basemap === "street") {
    return <TileLayer attribution="© OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />;
  }

  if (basemap === "gibs") {
    return (
      <TileLayer
        attribution="NASA GIBS"
        url={`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`}
        maxNativeZoom={9}
      />
    );
  }

  if (basemap === "night") {
    return (
      <TileLayer
        attribution="NASA GIBS Black Marble"
        url={`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_DayNightBand_At_Sensor_Radiance/default/${date}/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png`}
        maxNativeZoom={8}
      />
    );
  }

  return (
    <>
      <TileLayer
        attribution="Esri, HERE, Garmin"
        url="https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
      />
      <TileLayer
        attribution=""
        url="https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
      />
    </>
  );
}
