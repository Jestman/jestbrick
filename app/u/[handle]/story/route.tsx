import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { ogFonts, profileCard } from "@/lib/og";
import { getUser } from "@/lib/supabase/server";
import { envReady } from "@/db";

const YELLOW = "#F5C518";
const INK = "#20232E";

/** Instagram Story görseli (1080×1920) — profil sahibi indirir, story'de paylaşır. */
export async function GET(_req: Request, { params }: { params: Promise<{ handle: string }> }) {
  if (!envReady()) notFound();
  const { handle } = await params;
  const [card, fonts, viewer] = await Promise.all([profileCard(handle), ogFonts(), getUser()]);
  if (!card) notFound();
  // kapalı profilin story'sini yalnızca sahibi üretebilir
  if (!card.profilePublic && viewer?.id !== card.userId) notFound();

  const stats: [string, string][] = [
    [String(card.setCount), "SET"],
    [card.totalParts.toLocaleString("tr-TR"), "PARÇA"],
    [String(card.figCount), "MİNİFİGÜR"],
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          alignItems: "center", background: INK, color: "#fff", fontFamily: "Noto",
          padding: "120px 72px",
        }}
      >
        {/* tuğla logo */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 16, marginBottom: -10 }}>
            {[0, 1].map((i) => (
              <div key={i} style={{ width: 56, height: 42, background: YELLOW, borderRadius: 12, border: `5px solid ${INK}`, boxShadow: "0 0 0 5px " + YELLOW }} />
            ))}
          </div>
          <div style={{ width: 200, height: 92, background: YELLOW, borderRadius: 20 }} />
        </div>

        <div style={{ display: "flex", fontSize: 44, fontWeight: 800, marginTop: 40 }}>
          Jest<span style={{ color: YELLOW }}>Brick</span>
        </div>

        <div style={{ display: "flex", fontSize: 40, color: "#9aa0b0", marginTop: 130 }}>
          LEGO koleksiyonum 🧱
        </div>
        <div
          style={{
            display: "flex", fontSize: 86, fontWeight: 800, letterSpacing: -2,
            marginTop: 12, textAlign: "center",
          }}
        >
          {card.name}
        </div>
        <div style={{ display: "flex", fontSize: 36, color: "#9aa0b0", marginTop: 8 }}>
          @{card.handle}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28, marginTop: 90, width: "100%" }}>
          {stats.map(([n, label]) => (
            <div
              key={label}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "#2b2f3d", borderRadius: 28, padding: "36px 52px",
                borderLeft: `14px solid ${YELLOW}`,
              }}
            >
              <div style={{ display: "flex", fontSize: 84, fontWeight: 800, color: YELLOW }}>{n}</div>
              <div style={{ display: "flex", fontSize: 40, color: "#c6cad5", letterSpacing: 4 }}>{label}</div>
            </div>
          ))}
        </div>

        {card.topSets.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 80, gap: 14 }}>
            <div style={{ display: "flex", fontSize: 32, color: "#9aa0b0", letterSpacing: 3 }}>VİTRİNDEN</div>
            {card.topSets.map((s) => (
              <div key={s} style={{ display: "flex", fontSize: 40, fontWeight: 800, textAlign: "center" }}>
                {s}
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            display: "flex", marginTop: "auto", background: YELLOW, color: INK,
            fontSize: 40, fontWeight: 800, padding: "26px 56px", borderRadius: 99,
          }}
        >
          jestbrick.com/u/{card.handle}
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
      fonts: [
        { name: "Noto", data: fonts.regular, weight: 400 },
        { name: "Noto", data: fonts.bold, weight: 800 },
      ],
    }
  );
}
