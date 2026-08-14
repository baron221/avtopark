"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type GpsTrackPoint = { t: string; lat: number; lon: number };
export type GpsTrackStation = { label: string; lat: number; lon: number };

// Forced to the fleet's own timezone rather than the viewing device's — a
// GPS timestamp is a real UTC instant, and everyone reading this map is
// asking "what time was that in Farg'ona/Quva", not in their own locale.
function formatLocalTime(iso: string) {
  return new Date(iso).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent" });
}

function endpointIcon(color: string, glyph: string) {
  return L.divIcon({
    className: "",
    html: `<div style="width:26px;height:26px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:13px;line-height:1;color:white;font-weight:800">${glyph}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function stationIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="width:22px;height:22px;border-radius:50%;background:white;border:2px solid #E8590C;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:12px;line-height:1">🚉</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function FitBounds({ latLngs }: { latLngs: [number, number][] }) {
  const map = useMap();
  const didFit = useRef(false);
  useEffect(() => {
    if (didFit.current || latLngs.length === 0) return;
    didFit.current = true;
    const bounds = L.latLngBounds(latLngs);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [map, latLngs]);
  return null;
}

export default function GpsTrackMap({
  points,
  stations,
}: {
  points: GpsTrackPoint[];
  stations: GpsTrackStation[];
}) {
  if (points.length === 0) {
    return (
      <div className="h-[420px] flex items-center justify-center text-[13px] text-muted-2 font-semibold">
        Бу кун учун GPS маълумоти йўқ
      </div>
    );
  }

  const latLngs: [number, number][] = points.map((p) => [p.lat, p.lon]);
  const first = points[0];
  const last = points[points.length - 1];

  return (
    <MapContainer center={latLngs[0]} zoom={12} scrollWheelZoom style={{ height: 420, width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds latLngs={[...latLngs, ...stations.map((s): [number, number] => [s.lat, s.lon])]} />
      <Polyline positions={latLngs} pathOptions={{ color: "#3B5BDB", weight: 3, opacity: 0.8 }} />
      {stations.map((s) => (
        <Marker key={s.label} position={[s.lat, s.lon]} icon={stationIcon()}>
          <Popup>{s.label}</Popup>
        </Marker>
      ))}
      <Marker position={[first.lat, first.lon]} icon={endpointIcon("#1B9E6B", "Б")}>
        <Popup>Бошланиш · {formatLocalTime(first.t)}</Popup>
      </Marker>
      <Marker position={[last.lat, last.lon]} icon={endpointIcon("#E03131", "Т")}>
        <Popup>Тугаш · {formatLocalTime(last.t)}</Popup>
      </Marker>
    </MapContainer>
  );
}
