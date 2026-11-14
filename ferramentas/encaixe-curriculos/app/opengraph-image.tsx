import { ImageResponse } from "next/og";

export const alt = "Encaixe — Seu currículo na língua da vaga";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-static";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#0F766E",
          padding: "0 100px",
          color: "#FFFFFF",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 144, fontWeight: 700, letterSpacing: -4, lineHeight: 1 }}>Encaixe</div>
          <div style={{ fontSize: 44, marginTop: 28, opacity: 0.92 }}>Seu currículo na língua da vaga</div>
        </div>
        <div
          style={{
            width: 300,
            height: 300,
            borderRadius: 150,
            border: "14px solid #CCFBF1",
            background: "rgba(255,255,255,0.08)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ fontSize: 104, fontWeight: 700, lineHeight: 1 }}>81%</div>
          <div style={{ fontSize: 36, marginTop: 8, opacity: 0.9 }}>match</div>
        </div>
      </div>
    ),
    size
  );
}
