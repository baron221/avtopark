"use client";

import dynamic from "next/dynamic";
import type { GpsTrackPoint, GpsTrackStation } from "./GpsTrackMap";

// Same ssr:false requirement as GpsMapLoader — Leaflet touches `window` at
// import time.
const GpsTrackMap = dynamic(() => import("./GpsTrackMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[420px] flex items-center justify-center text-[13px] text-muted-2 font-semibold">
      Харита юкланмоқда…
    </div>
  ),
});

export function GpsTrackMapLoader({ points, stations }: { points: GpsTrackPoint[]; stations: GpsTrackStation[] }) {
  return <GpsTrackMap points={points} stations={stations} />;
}
