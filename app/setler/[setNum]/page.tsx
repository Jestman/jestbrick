import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { and, asc, eq } from "drizzle-orm";
import { db, envReady, schema } from "@/db";
import { getUser } from "@/lib/supabase/server";
import { addToCollection, removeFromCollection } from "@/lib/collection/actions";

async function CollectionButton({ setNum }: { setNum: string }) {
  const user = await getUser();
  if (!user) {
    return (
      <Link href={`/giris?sonra=/setler/${setNum}`} className="btn btn-y">
        🧱 Koleksiyona Ekle
      </Link>
    );
  }

  const owned = await db()
    .select({ id: schema.collectionItems.id })
    .from(schema.collectionItems)
    .where(
      and(
        eq(schema.collectionItems.userId, user.id),
        eq(schema.collectionItems.setNum, setNum)
      )
    )
    .limit(1);

  if (owned.length > 0) {
    return (
      <form action={removeFromCollection} style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input type="hidden" name="setNum" value={setNum} />
        <span style={{ color: "var(--green)", fontWeight: 700, fontSize: 14 }}>✓ Koleksiyonunda</span>
        <button className="btn btn-o" type="submit">Çıkar</button>
      </form>
    );
  }

  return (
    <form action={addToCollection}>
      <input type="hidden" name="setNum" value={setNum} />
      <button className="btn btn-y" type="submit">🧱 Koleksiyona Ekle</button>
    </form>
  );
}

async function MinifigSection({ setNum }: { setNum: string }) {
  const figs = await db()
    .select({
      figNum: schema.minifigs.figNum,
      name: schema.minifigs.name,
      imageUrl: schema.minifigs.imageUrl,
      quantity: schema.setMinifigs.quantity,
    })
    .from(schema.setMinifigs)
    .innerJoin(schema.minifigs, eq(schema.setMinifigs.figNum, schema.minifigs.figNum))
    .where(eq(schema.setMinifigs.setNum, setNum))
    .orderBy(asc(schema.minifigs.name));

  if (figs.length === 0) return null;

  return (
    <div style={{ marginTop: 22 }}>
      <h2 style={{ fontFamily: "var(--disp)", fontSize: 17, fontWeight: 800, marginBottom: 12 }}>
        Bu setteki minifigürler ({figs.reduce((a, f) => a + f.quantity, 0)})
      </h2>
      <div className="setgrid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
        {figs.map((f) => (
          <div key={f.figNum} className="setcard">
            <div className="img" style={{ height: 120 }}>
              {f.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.imageUrl} alt={f.name} loading="lazy" />
              ) : (
                <span style={{ fontSize: 34 }}>🙂</span>
              )}
            </div>
            <div className="meta">
              <b style={{ fontSize: 13 }}>{f.name}</b>
              <small>
                {f.figNum}
                {f.quantity > 1 ? ` · ${f.quantity} adet` : ""}
              </small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

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
            {s.retiredAt && <span style={{ color: "var(--red)", fontWeight: 700 }}>Emekli</span>}
          </div>

          <div style={{ marginTop: 20 }}>
            <Suspense fallback={<span style={{ color: "var(--ink3)", fontSize: 14 }}>…</span>}>
              <CollectionButton setNum={setNum} />
            </Suspense>
          </div>

          <Suspense fallback={null}>
            <MinifigSection setNum={setNum} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
