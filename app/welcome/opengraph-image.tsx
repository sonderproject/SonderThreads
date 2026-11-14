import { ImageResponse } from "next/og";

// The preview card shown when someone shares a Surfdesk link in a text,
// email or social post. (Image rendering can't read CSS variables, so the
// Sonder Studio palette is written out here: obsidian, warm white, surf blue.)
export const alt = "Surfdesk: never lose track of a client again";
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
          padding: "90px",
          background: "#0a0a09",
          color: "#f3f0eb",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 24, letterSpacing: 8, color: "#aea08d" }}>
          <span style={{ color: "#62b4e6" }}>SURFDESK</span>
          <span style={{ width: 60, height: 2, background: "#3e9bd4" }} />
          <span>BY SONDER PROJECT</span>
        </div>
        <div style={{ fontSize: 72, marginTop: 36, lineHeight: 1.05, maxWidth: 950 }}>
          The daily tool for the people you serve.
        </div>
        <div style={{ fontSize: 30, marginTop: 28, color: "#aea08d" }}>Clients, follow-ups, notes and reports in one app. Everything organized.</div>
      </div>
    ),
    size,
  );
}
