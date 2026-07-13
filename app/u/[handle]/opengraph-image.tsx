import { ImageResponse } from "next/og";
import { ogFonts, profileCard } from "@/lib/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "JestBrick koleksiyon kartı";

const YELLOW = "#F5C518";
const INK = "#20232E";

function Brick({ scale = 1 }: { scale?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ display: "flex", gap: 10 * scale, marginBottom: -6 * scale }}>
        {[0, 1].map((i) => (
          <div key={i} style={{ width: 34 * scale, height: 26 * scale, background: YELLOW, borderRadius: 8 * scale, border: `${3 * scale}px solid ${INK}` }} />
        ))}
      </div>
      <div style={{ width: 120 * scale, height: 56 * scale, background: YELLOW, borderRadius: 12 * scale, border: `${3 * scale}px solid ${INK}` }} />
    </div>
  );
}

export default async function OgImage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const [card, fonts] = await Promise.all([profileCard(handle), ogFonts()]);

  const stats: [string, string][] =
    card && card.profilePublic
      ? [
          [String(card.setCount), "set"],
          [card.totalParts.toLocaleString("tr-TR"), "parça"],
          [String(card.figCount), "minifigür"],
        ]
      : [];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          background: INK, color: "#fff", fontFamily: "Noto", padding: 64,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Brick scale={0.55} />
          <div style={{ display: "flex", fontSize: 40, fontWeight: 800 }}>
            Jest<span style={{ color: YELLOW }}>Brick</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 800, letterSpacing: -2 }}>
            {card?.name ?? "JestBrick"}
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#9aa0b0", marginTop: 4 }}>
            @{card?.handle ?? "jestbrick"}
            {card?.city ? ` · ${card.city}` : ""}
          </div>

          {stats.length > 0 ? (
            <div style={{ display: "flex", gap: 20, marginTop: 36 }}>
              {stats.map(([n, label]) => (
                <div
                  key={label}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    background: "#2b2f3d", borderRadius: 20, padding: "22px 40px",
                    borderBottom: `6px solid ${YELLOW}`,
                  }}
                >
                  <div style={{ display: "flex", fontSize: 52, fontWeight: 800, color: YELLOW }}>{n}</div>
                  <div style={{ display: "flex", fontSize: 24, color: "#c6cad5" }}>{label}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", fontSize: 32, color: "#c6cad5", marginTop: 36 }}>
              LEGO koleksiyoncularının buluşma noktası
            </div>
          )}
        </div>

        <div style={{ display: "flex", marginTop: 48, fontSize: 26, color: "#9aa0b0" }}>
          jestbrick.com{card ? `/u/${card.handle}` : ""} · LEGO koleksiyonunu sergile 🧱
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Noto", data: fonts.regular, weight: 400 },
        { name: "Noto", data: fonts.bold, weight: 800 },
      ],
    }
  );
}
