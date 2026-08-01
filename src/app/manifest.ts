import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Avtopark Foyda Tizimi",
    short_name: "Avtopark",
    description: "Farg'ona–Quva avtopark uchun foyda hisobi tizimi",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F6F7FB",
    theme_color: "#4F46E5",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
