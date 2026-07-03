import { notFound } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, envReady, schema } from "@/db";

export default async function SetDetayPage({
  params,
}: {
  params: Promise<{ setNum: string }>;
}) {
  const { setNum } = await params;
  if (!envReady()) notFound();

  const rows = await db()
    .select({
      set: schema.sets,
      themeName: schema.themes.name,
    })
    .from(schema.sets)
    .leftJoin(schema.themes, eq(schema.sets.themeId, schema.themes.id))
    .where(eq(schema.sets.setNum, setNum))
    .limit(1);

  const row = rows[0];
  if (!row) notFound();
  const s = row.set;
  const img = s.imagePath ?? s.imageUrl;

  return (
    <main className="wrap" style={{ maxWidth: 760 }}>
      <Link href="/setler" style={{ fontSize: 13.5, fontWeight: 600 }}>
        ← Kataloğa dön
      </Link>
      <div className="card" style={{ marginTop: 14, padding: 0, overflow: "hidden" }}>
        <div
          style={{
            background: "var(--soft)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 260,
            padding: 20,
          }}
        >
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt={s.name} style={{ maxHeight: 320, maxWidth: "100%" }} />
          ) : (
            <span style={{ fontSize: 64 }}>🧱</span>
          )}
        </div>
        <div style={{ padding: "20px 24px" }}>
          <h1 style={{ fontFamily: "var(--disp)", fontSize: 24, fontWeight: 800, letterSpacing: "-0.4px" }}>
            {s.name}
          </h1>
          <p style={{ color: "var(--ink2)", marginTop: 6, fontSize: 14 }}>
            #{s.setNum.replace(/-1$/, "")} · {row.themeName ?? "—"} · {s.year}
          </p>
          <div style={{ display: "flex", gap: 24, marginTop: 16, flexWrap: "wrap", fontSize: 14 }}>
            <span>
              <b style={{ fontFamily: "var(--disp)", fontSize: 18 }}>{s.numParts.toLocaleString("tr-TR")}</b>{" "}
              <span style={{ color: "var(--ink3)" }}>parça</span>
            </span>
            {s.msrpTry && (
              <span>
                <b style={{ fontFamily: "var(--disp)", fontSize: 18 }}>
                  {Number(s.msrpTry).toLocaleString("tr-TR")} ₺
                </b>{" "}
                <span style={{ color: "var(--ink3)" }}>liste fiyatı</span>
              </span>
            )}
            {s.retiredAt && (
              <span style={{ color: "var(--red)", fontWeight: 700 }}>Emekli</span>
            )}
          </div>
          <div className="notice" style={{ marginTop: 20 }}>
            Koleksiyona ekleme ve istek listesi <b>Faz 1</b>’de açılacak — şema hazır, sıra arayüzde.
          </div>
        </div>
      </div>
    </main>
  );
}
