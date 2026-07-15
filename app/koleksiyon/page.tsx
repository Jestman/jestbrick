import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, envReady, schema } from "@/db";
import { getUser } from "@/lib/supabase/server";
import { ConfirmSubmit } from "@/app/components/ConfirmSubmit";
import { PendingButton } from "@/app/components/PendingButton";
import {
  removeFromCollection,
  removeFromWishlist,
  wishToCollection,
  addMinifig,
  removeMinifig,
  updateCollectionItem,
} from "@/lib/collection/actions";

const CONDITION_TR: Record<string, string> = {
  sealed: "📦 Kapalı kutu",
  built: "🧱 Kurulu",
  parts: "🧩 Parçalarına ayrık",
};

export const metadata = { title: "Koleksiyonum" };

function SetImg({ img, name }: { img: string | null; name: string }) {
  return img ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={img} alt={name} loading="lazy" />
  ) : (
    <span style={{ fontSize: 40 }}>🧱</span>
  );
}

export default async function KoleksiyonPage({
  searchParams,
}: {
  searchParams: Promise<{ sekme?: string }>;
}) {
  if (!envReady()) redirect("/");
  const user = await getUser();
  if (!user) redirect("/giris?sonra=/koleksiyon");
  const { sekme } = await searchParams;
  const tab = sekme === "istek" ? "istek" : "koleksiyon";

  /* ---- veriler ---- */
  const [mySets, wishSets, figRows, deltas] = await Promise.all([
    db()
      .select({
        setNum: schema.sets.setNum,
        name: schema.sets.name,
        numParts: schema.sets.numParts,
        imagePath: schema.sets.imagePath,
        imageUrl: schema.sets.imageUrl,
        themeName: schema.themes.name,
        condition: schema.collectionItems.condition,
        note: schema.collectionItems.note,
      })
      .from(schema.collectionItems)
      .innerJoin(schema.sets, eq(schema.collectionItems.setNum, schema.sets.setNum))
      .leftJoin(schema.themes, eq(schema.sets.themeId, schema.themes.id))
      .where(eq(schema.collectionItems.userId, user.id))
      .orderBy(asc(schema.sets.name)),
    db()
      .select({
        setNum: schema.sets.setNum,
        name: schema.sets.name,
        numParts: schema.sets.numParts,
        imagePath: schema.sets.imagePath,
        imageUrl: schema.sets.imageUrl,
        themeName: schema.themes.name,
      })
      .from(schema.wishlistItems)
      .innerJoin(schema.sets, eq(schema.wishlistItems.setNum, schema.sets.setNum))
      .leftJoin(schema.themes, eq(schema.sets.themeId, schema.themes.id))
      .where(eq(schema.wishlistItems.userId, user.id))
      .orderBy(asc(schema.sets.name)),
    db()
      .select({
        figNum: schema.minifigs.figNum,
        figName: schema.minifigs.name,
        imageUrl: schema.minifigs.imageUrl,
        quantity: schema.setMinifigs.quantity,
        setName: schema.sets.name,
      })
      .from(schema.collectionItems)
      .innerJoin(schema.setMinifigs, eq(schema.collectionItems.setNum, schema.setMinifigs.setNum))
      .innerJoin(schema.minifigs, eq(schema.setMinifigs.figNum, schema.minifigs.figNum))
      .innerJoin(schema.sets, eq(schema.setMinifigs.setNum, schema.sets.setNum))
      .where(eq(schema.collectionItems.userId, user.id)),
    db()
      .select({
        figNum: schema.collectionMinifigs.figNum,
        delta: schema.collectionMinifigs.delta,
        figName: schema.minifigs.name,
        imageUrl: schema.minifigs.imageUrl,
      })
      .from(schema.collectionMinifigs)
      .innerJoin(schema.minifigs, eq(schema.collectionMinifigs.figNum, schema.minifigs.figNum))
      .where(eq(schema.collectionMinifigs.userId, user.id)),
  ]);

  /* ---- minifigür birleştirme: setlerden türetilen + tekil düzeltme ---- */
  type Fig = {
    figNum: string;
    name: string;
    imageUrl: string | null;
    derived: number;
    delta: number;
    sources: string[];
  };
  const figMap = new Map<string, Fig>();
  for (const r of figRows) {
    const f =
      figMap.get(r.figNum) ??
      { figNum: r.figNum, name: r.figName, imageUrl: r.imageUrl, derived: 0, delta: 0, sources: [] };
    f.derived += r.quantity;
    if (!f.sources.includes(r.setName)) f.sources.push(r.setName);
    figMap.set(r.figNum, f);
  }
  for (const d of deltas) {
    const f =
      figMap.get(d.figNum) ??
      { figNum: d.figNum, name: d.figName, imageUrl: d.imageUrl, derived: 0, delta: 0, sources: [] };
    f.delta += d.delta;
    figMap.set(d.figNum, f);
  }
  const figs = [...figMap.values()]
    .map((f) => ({ ...f, total: Math.max(0, f.derived + f.delta) }))
    .filter((f) => f.total > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));

  const totalParts = mySets.reduce((a, s) => a + s.numParts, 0);
  const totalFigs = figs.reduce((a, f) => a + f.total, 0);

  const sourceLabel = (f: (typeof figs)[number]) => {
    const parts: string[] = [];
    if (f.sources.length > 0) {
      parts.push(
        f.sources.slice(0, 2).join(", ") +
          (f.sources.length > 2 ? ` +${f.sources.length - 2}` : "") +
          " setinden"
      );
    }
    if (f.delta > 0) parts.push(`+${f.delta} tekil`);
    if (f.delta < 0) parts.push(`${-f.delta} ayrıldı`);
    return parts.join(" · ") || "tekil";
  };

  return (
    <main className="wrap">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <h1 className="page" style={{ marginBottom: 0 }}>Koleksiyonum</h1>
        <Link href="/koleksiyon/hizli-ekle" className="btn btn-y">⚡ Hızlı Ekle</Link>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        {[
          [mySets.length, "Set"],
          [totalParts.toLocaleString("tr-TR"), "Parça"],
          [totalFigs, "Minifigür"],
          [wishSets.length, "İstek"],
        ].map(([v, l]) => (
          <div key={l} className="card" style={{ padding: "12px 20px", minWidth: 100 }}>
            <b style={{ fontFamily: "var(--disp)", fontSize: 20, display: "block" }}>{v}</b>
            <span style={{ fontSize: 12, color: "var(--ink3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {l}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--line)", marginBottom: 20 }}>
        <Link
          href="/koleksiyon"
          style={{
            padding: "10px 16px", fontWeight: 700, fontSize: 14, color: tab === "koleksiyon" ? "var(--ink)" : "var(--ink3)",
            borderBottom: tab === "koleksiyon" ? "3px solid var(--yellow)" : "3px solid transparent", textDecoration: "none",
          }}
        >
          Koleksiyonum ({mySets.length})
        </Link>
        <Link
          href="/koleksiyon?sekme=istek"
          style={{
            padding: "10px 16px", fontWeight: 700, fontSize: 14, color: tab === "istek" ? "var(--ink)" : "var(--ink3)",
            borderBottom: tab === "istek" ? "3px solid var(--yellow)" : "3px solid transparent", textDecoration: "none",
          }}
        >
          İstek Listem ({wishSets.length})
        </Link>
      </div>

      {tab === "istek" ? (
        wishSets.length === 0 ? (
          <div className="notice">
            İstek listen boş. Bir setin sayfasında <b>☆ İstek Listeme</b>’ye bas — o set için ilan
            açıldığında haber vereceğiz (eşleştirme Faz 2’de).
          </div>
        ) : (
          <div className="setgrid">
            {wishSets.map((s) => (
              <div key={s.setNum} className="setcard">
                <Link href={`/setler/${s.setNum}`} style={{ color: "inherit" }}>
                  <div className="img"><SetImg img={s.imagePath ?? s.imageUrl} name={s.name} /></div>
                  <div className="meta">
                    <b>{s.name}</b>
                    <small>
                      #{s.setNum.replace(/-1$/, "")} · {s.themeName ?? "—"} · {s.numParts.toLocaleString("tr-TR")} parça
                    </small>
                  </div>
                </Link>
                <div style={{ display: "flex", gap: 6, padding: "0 14px 12px" }}>
                  <form action={wishToCollection} style={{ flex: 1 }}>
                    <input type="hidden" name="setNum" value={s.setNum} />
                    <button className="btn btn-y" type="submit" style={{ width: "100%", padding: "5px 10px", fontSize: 12.5 }}>
                      Aldım! 🎉
                    </button>
                  </form>
                  <form action={removeFromWishlist}>
                    <input type="hidden" name="setNum" value={s.setNum} />
                    <button className="btn btn-o" type="submit" style={{ padding: "5px 12px", fontSize: 12.5 }}>
                      Kaldır
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )
      ) : mySets.length === 0 && figs.length === 0 ? (
        <div className="notice">
          Henüz bir şey eklemedin. <Link href="/setler">Kataloğa git</Link> — set ekle ya da bir setin
          sayfasından tek minifigür ekle.
        </div>
      ) : (
        <>
          {mySets.length > 0 && (
            <div className="setgrid">
              {mySets.map((s) => (
                <div key={s.setNum} className="setcard">
                  <Link href={`/setler/${s.setNum}`} style={{ color: "inherit" }}>
                    <div className="img"><SetImg img={s.imagePath ?? s.imageUrl} name={s.name} /></div>
                    <div className="meta">
                      <b>{s.name}</b>
                      <small>
                        #{s.setNum.replace(/-1$/, "")} · {s.themeName ?? "—"} · {s.numParts.toLocaleString("tr-TR")} parça
                      </small>
                    </div>
                  </Link>
                  <form action={updateCollectionItem} style={{ display: "grid", gap: 6, padding: "0 14px 8px" }}>
                    <input type="hidden" name="setNum" value={s.setNum} />
                    <div style={{ display: "flex", gap: 6 }}>
                      {/* key=taze değer: React 19 form reset'i eski defaultValue'ya
                          döndürüyordu — key değişince select yeni değerle yeniden kurulur */}
                      <select
                        key={`c-${s.setNum}-${s.condition}`}
                        name="condition" defaultValue={s.condition}
                        style={{ flex: 1, minWidth: 0, padding: "5px 8px", border: "1.5px solid var(--line)", borderRadius: 8, fontSize: 12.5 }}
                      >
                        {Object.entries(CONDITION_TR).map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                      <PendingButton className="btn btn-o" style={{ padding: "4px 10px", fontSize: 12 }} title="Durumu kaydet" pendingText="…">
                        💾
                      </PendingButton>
                    </div>
                    <input
                      key={`n-${s.setNum}-${s.note ?? ""}`}
                      name="note" defaultValue={s.note ?? ""} maxLength={200}
                      placeholder="Not: kutu/talimat durumu…"
                      style={{ padding: "5px 9px", border: "1.5px solid var(--line)", borderRadius: 8, fontSize: 12.5 }}
                    />
                  </form>
                  <form action={removeFromCollection} style={{ padding: "0 14px 12px" }}>
                    <input type="hidden" name="setNum" value={s.setNum} />
                    <ConfirmSubmit className="btn btn-o" style={{ padding: "5px 12px", fontSize: 12.5 }} confirmText="Koleksiyondan çıksın mı?">
                      Çıkar
                    </ConfirmSubmit>
                  </form>
                </div>
              ))}
            </div>
          )}

          <h2 style={{ fontFamily: "var(--disp)", fontSize: 19, fontWeight: 800, margin: "34px 0 6px" }}>
            Minifigürlerim ({totalFigs})
          </h2>
          <p style={{ color: "var(--ink2)", fontSize: 13.5, marginBottom: 14 }}>
            Setlerinden otomatik derlenir; tekil eklediklerin ve çıkardıkların da hesaba katılır.
          </p>
          {figs.length === 0 ? (
            <div className="notice">
              Koleksiyonunda minifigür yok. Set sayfalarındaki minifigür kartlarından tekil ekleyebilirsin.
            </div>
          ) : (
            <div className="setgrid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
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
                    <small>{sourceLabel(f)}</small>
                  </div>
                  <div style={{ display: "flex", gap: 6, padding: "0 12px 11px" }}>
                    <form action={addMinifig}>
                      <input type="hidden" name="figNum" value={f.figNum} />
                      <button className="btn btn-o" type="submit" style={{ padding: "4px 12px", fontSize: 13 }} title="Bir adet ekle">
                        +
                      </button>
                    </form>
                    <form action={removeMinifig}>
                      <input type="hidden" name="figNum" value={f.figNum} />
                      <button className="btn btn-o" type="submit" style={{ padding: "4px 12px", fontSize: 13 }} title="Bir adet çıkar (ör. sattım)">
                        −
                      </button>
                    </form>
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
