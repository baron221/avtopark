import { ImageResponse } from "next/og";

export const size = { width: 48, height: 48 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#4F46E5",
          borderRadius: 10,
          color: "#fff",
          fontSize: 22,
          fontWeight: 800,
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        FQ
      </div>
    ),
    { ...size }
  );
}
