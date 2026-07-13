import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db, envReady, schema } from "@/db";
import { getUser } from "@/lib/supabase/server";
import {
  addToCollection,
  removeFromCollection,
  addToWishlist,
  removeFromWishlist,
  addMinifig,
  removeMinifig,
} from "@/lib/collection/actions";
import { startConversation } from "@/lib/messages/actions";
import { wishersOf } from "@/lib/matching/queries";
import { Avatar } from "@/app/components/Avatar";
import { mediaUrl } from "@/lib/media";
import { BulkForm } from "./BulkForm";
import { ConfirmSubmit } from "@/app/components/ConfirmSubmit";
import { PendingButton } from "@/app/components/PendingButton";

/** Google: set sayfası metadata'sı — "LEGO 21319 Central Perk" aramaları hedefi. */
export async function generateMetadata({ params }: { params: Promise<{ setNum: string }> }) {
  const { setNum } = await params;
  if (!envReady()) return {};
  const [s] = await db()
    .select({
      name: schema.sets.name,
      year: schema.sets.year,
      numParts: schema.sets.numParts,
      imageUrl: schema.sets.imageUrl,
      imagePath: schema.sets.imagePath,
      retiredAt: schema.sets.retiredAt,
      themeName: schema.themes.name,
    })
    .from(schema.sets)
    .leftJoin(schema.themes, eq(schema.sets.themeId, schema.themes.id))
    .where(eq(schema.sets.setNum, setNum))
    .limit(1);
  if (!s) return {};
  const no = setNum.replace(/-1$/, "");
  const title = `LEGO ${no} ${s.name}`;
  const description = `LEGO ${no} ${s.name} (${s.themeName ?? "LEGO"}, ${s.year}) — ${s.numParts.toLocaleString(
    "tr-TR"
  )} parça${s.retiredAt ? ", emekli set" : ""}. Kimlerde var, kimler arıyor, satılık ilanlar ve güncel durum JestBrick'te.`;
  const img = s.imagePath ?? s.imageUrl;
  return {
    title,
    description,
    alternates: { canonical: `/setler/${setNum}` },
    openGraph: { title, description, images: img ? [{ url: img }] : undefined },
  };
}

async function ActionButtons({ setNum }: { setNum: string }) {
  const user = await getUser();
  if (!user) {
    return (
      <Link href={`/giris?sonra=/setler/${setNum}`} className="btn btn-y">
        🧱 Koleksiyona Ekle
      </Link>
    );
  }

  const [owned, wished] = await Promise.all([
    db()
      .select({ id: schema.collectionItems.id })
      .from(schema.collectionItems)
      .where(
        and(
          eq(schema.collectionItems.userId, user.id),
          eq(schema.collectionItems.setNum, setNum)
        )
      )
      .limit(1),
    db()
      .select({ id: schema.wishlistItems.id })
      .from(schema.wishlistItems)
      .where(
        and(
          eq(schema.wishlistItems.userId, user.id),
          eq(schema.wishlistItems.setNum, setNum)
        )
      )
      .limit(1),
  ]);

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      {owned.length > 0 ? (
        <>
          <form action={removeFromCollection} style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="hidden" name="setNum" value={setNum} />
            <span style={{ color: "var(--green)", fontWeight: 700, fontSize: 14 }}>✓ Koleksiyonunda</span>
            <ConfirmSubmit className="btn btn-o" confirmText="Çıksın mı?">Çıkar</ConfirmSubmit>
          </form>
          <Link href={`/pazar/yeni?set=${setNum}`} className="btn btn-o">
            🏷️ Satışa Çıkar
          </Link>
        </>
      ) : (
        <>
          <form action={addToCollection}>
            <input type="hidden" name="setNum" value={setNum} />
            <button className="btn btn-y" type="submit">🧱 Koleksiyona Ekle</button>
          </form>
          {wished.length > 0 ? (
            <form action={removeFromWishlist}>
              <input type="hidden" name="setNum" value={setNum} />
              <button className="btn btn-o" type="submit">★ İstek Listemde · Kaldır</button>
            </form>
          ) : (
            <form action={addToWishlist}>
              <input type="hidden" name="setNum" value={setNum} />
              <button className="btn btn-o" type="submit">☆ İstek Listeme</button>
            </form>
          )}
        </>
      )}
    </div>
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

  // Girişliyse: bu figürlerden kullanıcıda kaç tane var (setlerden + tekil)?
  const user = await getUser();
  const ownedMap = new Map<string, number>();
  if (user) {
    const figNums = figs.map((f) => f.figNum);
    const [derived, deltas] = await Promise.all([
      db()
        .select({
          figNum: schema.setMinifigs.figNum,
          q: sql<number>`coalesce(sum(${schema.setMinifigs.quantity}), 0)::int`,
        })
        .from(schema.collectionItems)
        .innerJoin(
          schema.setMinifigs,
          eq(schema.collectionItems.setNum, schema.setMinifigs.setNum)
        )
        .where(
          and(
            eq(schema.collectionItems.userId, user.id),
            inArray(schema.setMinifigs.figNum, figNums)
          )
        )
        .groupBy(schema.setMinifigs.figNum),
      db()
        .select({
          figNum: schema.collectionMinifigs.figNum,
          delta: schema.collectionMinifigs.delta,
        })
        .from(schema.collectionMinifigs)
        .where(
          and(
            eq(schema.collectionMinifigs.userId, user.id),
            inArray(schema.collectionMinifigs.figNum, figNums)
          )
        ),
    ]);
    for (const d of derived) ownedMap.set(d.figNum, d.q);
    for (const d of deltas) ownedMap.set(d.figNum, (ownedMap.get(d.figNum) ?? 0) + d.delta);
  }

  return (
    <div style={{ marginTop: 22 }}>
      <h2 style={{ fontFamily: "var(--disp)", fontSize: 17, fontWeight: 800, marginBottom: 6 }}>
        Bu setteki minifigürler ({figs.reduce((a, f) => a + f.quantity, 0)})
      </h2>
      {user && (
        <p style={{ color: "var(--ink2)", fontSize: 13, marginBottom: 12 }}>
          Set sende olmasa da figürü tek başına koleksiyonuna ekleyebilirsin.
        </p>
      )}
      <div className="setgrid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
        {figs.map((f) => {
          const owned = ownedMap.get(f.figNum) ?? 0;
          return (
            <div key={f.figNum} className="setcard">
              <div className="img" style={{ height: 120, position: "relative" }}>
                {f.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.imageUrl} alt={f.name} loading="lazy" />
                ) : (
                  <span style={{ fontSize: 34 }}>🙂</span>
                )}
                {owned > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      background: "var(--green)",
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 800,
                      padding: "2px 8px",
                      borderRadius: 99,
                    }}
                  >
                    sende ×{owned}
                  </span>
                )}
              </div>
              <div className="meta">
                <b style={{ fontSize: 13 }}>{f.name}</b>
                <small>
                  {f.figNum}
                  {f.quantity > 1 ? ` · sette ${f.quantity} adet` : ""}
                </small>
              </div>
              {user && (
                <div style={{ display: "flex", gap: 6, padding: "0 12px 11px" }}>
                  <form action={addMinifig} style={{ flex: 1 }}>
                    <input type="hidden" name="figNum" value={f.figNum} />
                    <input type="hidden" name="back" value={`/setler/${setNum}`} />
                    <button
                      className="btn btn-y"
                      type="submit"
                      style={{ width: "100%", padding: "5px 8px", fontSize: 12.5 }}
                    >
                      + Ekle
                    </button>
                  </form>
                  {owned > 0 && (
                    <form action={removeMinifig}>
                      <input type="hidden" name="figNum" value={f.figNum} />
                      <input type="hidden" name="back" value={`/setler/${setNum}`} />
                      <button
                        className="btn btn-o"
                        type="submit"
                        style={{ padding: "5px 10px", fontSize: 12.5 }}
                        title="Bir adet çıkar"
                      >
                        −
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

async function WishersSection({ setNum, setName }: { setNum: string; setName: string }) {
  const user = await getUser();
  const wishers = await wishersOf(setNum, user?.id);
  if (wishers.length === 0) return null;

  let ownedByMe = false;
  if (user) {
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
    ownedByMe = owned.length > 0;
  }

  return (
    <div style={{ marginTop: 26, borderTop: "1px solid var(--line)", paddingTop: 18 }}>
      <h2 style={{ fontFamily: "var(--disp)", fontSize: 17, fontWeight: 800, marginBottom: 4 }}>
        🔥 Bu seti isteyenler ({wishers.length})
      </h2>
      <p style={{ color: "var(--ink2)", fontSize: 13, marginBottom: 12 }}>
        İstek listesine ekleyen, iletişime açık üyeler — bütçe girenler önde.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {wishers.map((w) => (
          <div key={w.userId} style={{ display: "flex", gap: 11, alignItems: "center", background: "var(--soft)", borderRadius: 12, padding: "10px 14px" }}>
            <Link href={`/u/${w.handle}`}>
              <Avatar handle={w.handle} name={w.displayName} size={38} src={mediaUrl(w.avatarPath)} />
            </Link>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Link href={`/u/${w.handle}`} style={{ fontWeight: 700, fontSize: 14, color: "inherit" }}>
                {w.displayName || w.handle}
              </Link>
              <div style={{ fontSize: 12, color: "var(--ink3)" }}>
                @{w.handle}
                {w.city ? ` · ${w.city}` : ""}
                {w.maxPriceTry ? ` · bütçe ${Number(w.maxPriceTry).toLocaleString("tr-TR")} ₺` : ""}
              </div>
            </div>
            {user && (
              <form action={startConversation}>
                <input type="hidden" name="userId" value={w.userId} />
                <input
                  type="hidden"
                  name="text"
                  value={`Merhaba! İstek listende ${setName} (#${setNum.replace(/-1$/, "")}) görünüyor — bende var, ilgilenirsen konuşalım 🧱`}
                />
                <PendingButton className="btn btn-o" style={{ padding: "6px 14px", fontSize: 13 }} pendingText="…">
                  Mesaj
                </PendingButton>
              </form>
            )}
          </div>
        ))}
      </div>
      {user && ownedByMe ? (
        <BulkForm setNum={setNum} count={wishers.length} />
      ) : user ? (
        <p style={{ fontSize: 12.5, color: "var(--ink3)", marginTop: 10, textAlign: "center" }}>
          💡 Bu set koleksiyonunda olsaydı isteyenlere tek tıkla toplu mesaj gönderebilirdin.
        </p>
      ) : null}
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

  // Google Product yapısal verisi: aktif ilanlar teklife dönüşür
  const offers = await db()
    .select({ priceTry: schema.listings.priceTry })
    .from(schema.listings)
    .where(and(eq(schema.listings.setNum, setNum), eq(schema.listings.status, "active")));
  const no = setNum.replace(/-1$/, "");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `LEGO ${no} ${s.name}`,
    sku: no,
    brand: { "@type": "Brand", name: "LEGO" },
    image: img ?? undefined,
    description: `${s.numParts.toLocaleString("tr-TR")} parçalı ${s.year} çıkışlı LEGO seti${s.retiredAt ? " (emekli)" : ""}.`,
    ...(offers.length > 0
      ? {
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: "TRY",
            lowPrice: Math.min(...offers.map((o) => Number(o.priceTry))),
            highPrice: Math.max(...offers.map((o) => Number(o.priceTry))),
            offerCount: offers.length,
            availability: "https://schema.org/InStock",
          },
        }
      : {}),
  };

  return (
    <main className="wrap" style={{ maxWidth: 760 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
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
              <ActionButtons setNum={setNum} />
            </Suspense>
          </div>

          <Suspense fallback={null}>
            <MinifigSection setNum={setNum} />
          </Suspense>

          <Suspense fallback={null}>
            <WishersSection setNum={setNum} setName={s.name} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
