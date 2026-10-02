import { ImageResponse } from "next/og";

// The preview card shown when someone shares a sonderthreads link in a text,
// email or social post.
export const alt = "sonderthreads: lists, notes and dates in one place";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0a0a0a",
          color: "#e8e8e6",
          fontFamily: "monospace",
        }}
      >
        <div style={{ fontSize: 64, color: "#5eead4" }}>&gt; sonderthreads</div>
        <div style={{ fontSize: 44, marginTop: 32 }}>lists, notes and dates. one place.</div>
        <div style={{ fontSize: 32, marginTop: 20, color: "#8a8a86" }}>type it or say it. it files itself.</div>
      </div>
    ),
    size,
  );
}
