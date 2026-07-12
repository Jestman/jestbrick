import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, envReady, schema } from "@/db";
import { getUser } from "@/lib/supabase/server";
import { removeFromCollection } from "@/lib/collection/actions";

export const metadata = { title: "Koleksiyonum" };

export default async function KoleksiyonPage() {
  if (!envReady()) redirect("/");
  const user = await getUser();
  if (!user) redirect("/giris?sonra=/koleksiyon");

  // Setlerim
  const mySets = await db()
    .select({
      setNum: schema.sets.setNum,
      name: schema.sets.name,
      year: schema.sets.year,
      numParts: schema.sets.numParts,
      imagePath: schema.sets.imagePath,
      imageUrl: schema.sets.imageUrl,
      themeName: schema.themes.name,
    })
    .from(schema.collectionItems)
    .innerJoin(schema.sets, eq(schema.collectionItems.setNum, schema.sets.setNum))
    .leftJoin(schema.themes, eq(schema.sets.themeId, schema.themes.id))
    .where(eq(schema.collectionItems.userId, user.id))
    .orderBy(asc(schema.sets.name));

  // Minifigürlerim: koleksiyondaki setlerden türetilir
  const figRows = await db()
    .select({
      figNum: schema.minifigs.figNum,
      figName: schema.minifigs.name,
      imageUrl: schema.minifigs.imageUrl,
      quantity: schema.setMinifigs.quantity,
      setName: schema.sets.name,
      setNum: schema.sets.setNum,
    })
    .from(schema.collectionItems)
    .innerJoin(schema.setMinifigs, eq(schema.collectionItems.setNum, schema.setMinifigs.setNum))
    .innerJoin(schema.minifigs, eq(schema.setMinifigs.figNum, schema.minifigs.figNum))
    .innerJoin(schema.sets, eq(schema.setMinifigs.setNum, schema.sets.setNum))
    .where(eq(schema.collectionItems.userId, user.id));

  type Fig = {
    figNum: string;
    name: string;
    imageUrl: string | null;
    total: number;
    sources: { setNum: string; setName: string }[];
  };
  const figMap = new Map<string, Fig>();
  for (const r of figRows) {
    const f = figMap.get(r.figNum) ?? {
      figNum: r.figNum,
      name: r.figName,
      imageUrl: r.imageUrl,
      total: 0,
      sources: [],
    };
    f.total += r.quantity;
    f.sources.push({ setNum: r.setNum, setName: r.setName });
    figMap.set(r.figNum, f);
  }
  const figs = [...figMap.values()].sort((a, b) => a.name.localeCompare(b.name, "tr"));

  const totalParts = mySets.reduce((a, s) => a + s.numParts, 0);
  const totalFigs = figs.reduce((a, f) => a + f.total, 0);

  return (
    <main className="wrap">
      <h1 className="page">Koleksiyonum</h1>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 22 }}>
        {[
          [mySets.length, "Set"],
          [totalParts.toLocaleString("tr-TR"), "Parça"],
          [totalFigs, "Minifigür"],
        ].map(([v, l]) => (
          <div key={l} className="card" style={{ padding: "12px 20px", minWidth: 110 }}>
            <b style={{ fontFamily: "var(--disp)", fontSize: 20, display: "block" }}>{v}</b>
            <span style={{ fontSize: 12, color: "var(--ink3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {l}
            </span>
          </div>
        ))}
      </div>

      {mySets.length === 0 ? (
        <div className="notice">
          Henüz set eklemedin. <Link href="/setler">Kataloğa git</Link>, bir setin sayfasında
          “Koleksiyona Ekle”ye bas — minifigürleri de otomatik burada görünür.
        </div>
      ) : (
        <>
          <div className="setgrid">
            {mySets.map((s) => {
              const img = s.imagePath ?? s.imageUrl;
              return (
                <div key={s.setNum} className="setcard" style={{ position: "relative" }}>
                  <Link href={`/setler/${s.setNum}`} style={{ color: "inherit" }}>
                    <div className="img">
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt={s.name} loading="lazy" />
                      ) : (
                        <span style={{ fontSize: 40 }}>🧱</span>
                      )}
                    </div>
                    <div className="meta">
                      <b>{s.name}</b>
                      <small>
                        #{s.setNum.replace(/-1$/, "")} · {s.themeName ?? "—"} ·{" "}
                        {s.numParts.toLocaleString("tr-TR")} parça
                      </small>
                    </div>
                  </Link>
                  <form action={removeFromCollection} style={{ padding: "0 14px 12px" }}>
                    <input type="hidden" name="setNum" value={s.setNum} />
                    <button
                      className="btn btn-o"
                      style={{ padding: "5px 12px", fontSize: 12.5 }}
                      type="submit"
                    >
                      Çıkar
                    </button>
                  </form>
                </div>
              );
            })}
          </div>

          <h2 style={{ fontFamily: "var(--disp)", fontSize: 19, fontWeight: 800, margin: "34px 0 6px" }}>
            Minifigürlerim ({totalFigs})
          </h2>
          <p style={{ color: "var(--ink2)", fontSize: 13.5, marginBottom: 14 }}>
            Koleksiyonundaki setlerden otomatik derlendi.
          </p>
          {figs.length === 0 ? (
            <div className="notice">Koleksiyonundaki setlerde kayıtlı minifigür yok.</div>
          ) : (
            <div className="setgrid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
              {figs.map((f) => (
                <div key={f.figNum} className="setcard">
                  <div className="img" style={{ height: 130 }}>
                    {f.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.imageUrl} alt={f.name} loading="lazy" />
                    ) : (
                      <span style={{ fontSize: 36 }}>🙂</span>
                    )}
                  </div>
                  <div className="meta">
                    <b style={{ fontSize: 13 }}>
                      {f.name}
                      {f.total > 1 ? ` ×${f.total}` : ""}
                    </b>
                    <small>
                      {f.sources
                        .slice(0, 2)
                        .map((s) => s.setName)
                        .join(", ")}
                      {f.sources.length > 2 ? ` +${f.sources.length - 2}` : ""}{" "}
                      setinden
                    </small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
