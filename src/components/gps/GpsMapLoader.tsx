"use client";

import dynamic from "next/dynamic";
import type { GpsMapPoint } from "./GpsMap";

// Leaflet touches `window` at import time, so it can only ever run in the
// browser — ssr:false is required here, and (per Next.js 16) only works
// when the dynamic() call itself lives in a Client Component.
const GpsMap = dynamic(() => import("./GpsMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[380px] flex items-center justify-center text-[13px] text-muted-2 font-semibold">
      Харита юкланмоқда…
    </div>
  ),
});

export function GpsMapLoader({ points }: { points: GpsMapPoint[] }) {
  return <GpsMap points={points} />;
}
