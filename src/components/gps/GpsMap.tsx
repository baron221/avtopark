"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type GpsMapPoint = {
  id: string;
  plate: string;
  driverName: string;
  lat: number;
  lon: number;
  speedKmh: number;
  lastUpdateLabel: string;
};

// Leaflet's default marker icon resolves image paths relative to the bundler
// output, which breaks under webpack/Turbopack — an emoji glyph avoids that
// whole class of bug instead of trying to fix asset URLs, while still
// reading as "this is a minivan" (the fleet is all JAC SunRay) at a glance.
function markerIcon(moving: boolean) {
  const color = moving ? "#1B9E6B" : "#6B6D82";
  return L.divIcon({
    className: "",
    html: `<div style="width:26px;height:26px;border-radius:50%;background:white;border:2px solid ${color};box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:14px;line-height:1">🚐</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function FitBounds({ points }: { points: GpsMapPoint[] }) {
  const map = useMap();
  const didFit = useRef(false);
  useEffect(() => {
    if (didFit.current || points.length === 0) return;
    didFit.current = true;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lon]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [map, points]);
  return null;
}

export default function GpsMap({ points }: { points: GpsMapPoint[] }) {
  if (points.length === 0) {
    return (
      <div className="h-[320px] flex items-center justify-center text-[13px] text-muted-2 font-semibold">
        Кўрсатиш учун жойлашув маълумоти йўқ
      </div>
    );
  }

  return (
    <MapContainer
      center={[points[0].lat, points[0].lon]}
      zoom={12}
      scrollWheelZoom
      style={{ height: 380, width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={points} />
      {points.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lon]} icon={markerIcon(p.speedKmh > 0)}>
          <Popup>
            <div className="font-extrabold">{p.plate}</div>
            <div>{p.driverName}</div>
            <div>{p.speedKmh > 0 ? `${p.speedKmh} км/соат` : "тўхтаган"}</div>
            <div className="text-xs text-gray-500">{p.lastUpdateLabel}</div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
