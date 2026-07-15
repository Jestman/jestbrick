import { notFound } from "next/navigation";
import Link from "next/link";
import { and, asc, count, eq, sql } from "drizzle-orm";
import { db, envReady, schema } from "@/db";
import { getUser } from "@/lib/supabase/server";
import { follow, unfollow } from "@/lib/social/actions";
import { Avatar, RoleBadge } from "@/app/components/Avatar";
import { avatarHue, timeAgo } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import { activeListings, sellerStats } from "@/lib/market/queries";
import { getFlags } from "@/lib/settings";
import { CopyLink } from "./CopyLink";

/** Paylaşım kartları (WhatsApp/Instagram/X) için OG başlığı. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  if (!envReady()) return {};
  const [u] = await db()
    .select({
      displayName: schema.users.displayName,
      handle: schema.users.handle,
      bio: schema.users.bio,
      profilePublic: schema.users.profilePublic,
      id: schema.users.id,
    })
    .from(schema.users)
    .where(eq(schema.users.handle, handle.toLowerCase()))
    .limit(1);
  if (!u) return {};
  const name = u.displayName || `@${u.handle}`;
  if (!u.profilePublic) return { title: `${name} — JestBrick` };

  const [stats] = await db()
    .select({
      sets: sql<number>`count(*)::int`,
      parts: sql<number>`coalesce(sum(${schema.sets.numParts}), 0)::int`,
    })
    .from(schema.collectionItems)
    .innerJoin(schema.sets, eq(schema.collectionItems.setNum, schema.sets.setNum))
    .where(and(eq(schema.collectionItems.userId, u.id), eq(schema.collectionItems.visibility, "public")));

  const desc =
    stats && stats.sets > 0
      ? `${stats.sets} set · ${Number(stats.parts).toLocaleString("tr-TR")} parça — ${name} LEGO koleksiyonunu JestBrick'te sergiliyor.`
      : `${name} JestBrick'te — LEGO koleksiyoncularının buluşma noktası.`;
  return {
    title: `${name} — LEGO Koleksiyonu`,
    description: u.bio || desc,
    openGraph: { title: `${name} — LEGO Koleksiyonu 🧱`, description: desc },
  };
}

export default async function ProfilPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  if (!envReady()) notFound();

  const rows = await db()
    .select()
    .from(schema.users)
    .where(eq(schema.users.handle, handle.toLowerCase()))
    .limit(1);
  const u = rows[0];
  if (!u) notFound();

  const viewer = await getUser();
  const isMe = viewer?.id === u.id;

  // Kapalı profil: üye olmayan ziyaretçi vitrini göremez, kayıt kapısı görür
  if (!u.profilePublic && !viewer) {
    return (
      <main className="wrap" style={{ maxWidth: 480 }}>
        <div className="card" style={{ padding: 28, textAlign: "center" }}>
          <Avatar handle={u.handle} name={u.displayName} size={72} src={mediaUrl(u.avatarPath)} />
          <h1 style={{ fontFamily: "var(--disp)", fontSize: 21, fontWeight: 800, marginTop: 12 }}>
            {u.displayName || u.handle}
          </h1>
          <p style={{ color: "var(--ink3)", fontSize: 14 }}>@{u.handle}</p>
          <p style={{ margin: "16px 0", fontSize: 14.5, color: "var(--ink2)" }}>
            🔒 Bu koleksiyon yalnızca JestBrick üyelerine açık.
          </p>
          <Link href={`/kayit?sonra=/u/${u.handle}`} className="btn btn-y" style={{ marginRight: 8 }}>
            Ücretsiz Katıl
          </Link>
          <Link href={`/giris?sonra=/u/${u.handle}`} className="btn btn-o">
            Giriş Yap
          </Link>
        </div>
      </main>
    );
  }

  const [
    [{ followers }],
    [{ following }],
    viewerFollows,
    mySets,
    figRows,
    deltas,
    wishSets,
  ] = await Promise.all([
    db().select({ followers: count() }).from(schema.follows).where(eq(schema.follows.followeeId, u.id)),
    db().select({ following: count() }).from(schema.follows).where(eq(schema.follows.followerId, u.id)),
    viewer && !isMe
      ? db()
          .select({ f: schema.follows.followerId })
          .from(schema.follows)
          .where(and(eq(schema.follows.followerId, viewer.id), eq(schema.follows.followeeId, u.id)))
          .limit(1)
      : Promise.resolve([]),
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
      .where(and(eq(schema.collectionItems.userId, u.id), eq(schema.collectionItems.visibility, "public")))
      .orderBy(asc(schema.sets.name)),
    db()
      .select({
        figNum: schema.minifigs.figNum,
        name: schema.minifigs.name,
        imageUrl: schema.minifigs.imageUrl,
        q: sql<number>`sum(${schema.setMinifigs.quantity})::int`,
      })
      .from(schema.collectionItems)
      .innerJoin(schema.setMinifigs, eq(schema.collectionItems.setNum, schema.setMinifigs.setNum))
      .innerJoin(schema.minifigs, eq(schema.setMinifigs.figNum, schema.minifigs.figNum))
      .where(eq(schema.collectionItems.userId, u.id))
      .groupBy(schema.minifigs.figNum, schema.minifigs.name, schema.minifigs.imageUrl),
    db()
      .select({
        figNum: schema.collectionMinifigs.figNum,
        delta: schema.collectionMinifigs.delta,
        name: schema.minifigs.name,
        imageUrl: schema.minifigs.imageUrl,
      })
      .from(schema.collectionMinifigs)
      .innerJoin(schema.minifigs, eq(schema.collectionMinifigs.figNum, schema.minifigs.figNum))
      .where(eq(schema.collectionMinifigs.userId, u.id)),
    u.wishlistPublic
      ? db()
          .select({
            setNum: schema.sets.setNum,
            name: schema.sets.name,
            imagePath: schema.sets.imagePath,
            imageUrl: schema.sets.imageUrl,
          })
          .from(schema.wishlistItems)
          .innerJoin(schema.sets, eq(schema.wishlistItems.setNum, schema.sets.setNum))
          .where(eq(schema.wishlistItems.userId, u.id))
          .orderBy(asc(schema.sets.name))
      : Promise.resolve([]),
  ]);

  // minifigür toplamları (türetilen + tekil düzeltme)
  type Fig = { figNum: string; name: string; imageUrl: string | null; total: number };
  const figMap = new Map<string, Fig>();
  for (const r of figRows)
    figMap.set(r.figNum, { figNum: r.figNum, name: r.name, imageUrl: r.imageUrl, total: r.q });
  for (const d of deltas) {
    const f = figMap.get(d.figNum) ?? { figNum: d.figNum, name: d.name, imageUrl: d.imageUrl, total: 0 };
    f.total += d.delta;
    figMap.set(d.figNum, f);
  }
  const figs = [...figMap.values()].filter((f) => f.total > 0).sort((a, b) => a.name.localeCompare(b.name, "tr"));

  const totalParts = mySets.reduce((a, s) => a + s.numParts, 0);
  const totalFigs = figs.reduce((a, f) => a + f.total, 0);
  const hue = avatarHue(u.handle);

  // pazar vitrini: aktif ilanlar + satıcı karnesi (yorumlu puanlar)
  const flags = await getFlags();
  const [myListings, sStats, ratings] = flags.market_enabled
    ? await Promise.all([
        activeListings({ sellerId: u.id }),
        sellerStats(u.id),
        db()
          .select({
            id: schema.sellerRatings.id,
            score: schema.sellerRatings.score,
            comment: schema.sellerRatings.comment,
            createdAt: schema.sellerRatings.createdAt,
            raterHandle: schema.users.handle,
            raterName: schema.users.displayName,
          })
          .from(schema.sellerRatings)
          .innerJoin(schema.users, eq(schema.sellerRatings.raterId, schema.users.id))
          .where(eq(schema.sellerRatings.sellerId, u.id))
          .orderBy(sql`${schema.sellerRatings.createdAt} desc`)
          .limit(10),
      ])
    : [[], { avgScore: null, ratingCount: 0, soldCount: 0 }, []];

  return (
    <main className="wrap" style={{ maxWidth: 860 }}>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="studs" style={{ height: 120, background: `linear-gradient(120deg, hsl(${hue}, 45%, 30%), var(--ink))` }} />
        <div style={{ padding: "0 24px 22px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
            <div style={{ marginTop: -42, border: "4px solid #fff", borderRadius: "50%", lineHeight: 0 }}>
              <Avatar handle={u.handle} name={u.displayName} size={84} src={mediaUrl(u.avatarPath)} />
            </div>
            <div style={{ marginLeft: "auto", paddingTop: 12 }}>
              {isMe ? (
                <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
                  <CopyLink handle={u.handle} />
                  <a href={`/u/${u.handle}/story`} target="_blank" className="btn btn-o" title="Instagram Story görseli">
                    📱 Story
                  </a>
                  <Link href="/hesap/profil" className="btn btn-o">Profili Düzenle</Link>
                </span>
              ) : viewer ? (
                viewerFollows.length > 0 ? (
                  <form action={unfollow}>
                    <input type="hidden" name="userId" value={u.id} />
                    <input type="hidden" name="back" value={`/u/${u.handle}`} />
                    <button className="btn btn-o" type="submit">Takiptesin ✓</button>
                  </form>
                ) : (
                  <form action={follow}>
                    <input type="hidden" name="userId" value={u.id} />
                    <input type="hidden" name="back" value={`/u/${u.handle}`} />
                    <button className="btn btn-y" type="submit">Takip Et</button>
                  </form>
                )
              ) : (
                <Link href={`/kayit?sonra=/u/${u.handle}`} className="btn btn-y">Takip Et</Link>
              )}
            </div>
          </div>
          <h1
            style={{
              fontFamily: "var(--disp)", fontSize: 22, fontWeight: 800, marginTop: 12,
              display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap",
            }}
          >
            {u.displayName || u.handle} <RoleBadge role={u.role} />
          </h1>
          <p style={{ color: "var(--ink3)", fontSize: 14 }}>
            @{u.handle}
            {u.city ? ` · ${u.city}` : ""}
          </p>
          {u.bio && <p style={{ marginTop: 10, maxWidth: "60ch" }}>{u.bio}</p>}
          <div style={{ display: "flex", gap: 20, marginTop: 14, fontSize: 14, color: "var(--ink2)", flexWrap: "wrap" }}>
            <span><b style={{ color: "var(--ink)" }}>{followers}</b> takipçi</span>
            <span><b style={{ color: "var(--ink)" }}>{following}</b> takip</span>
            <span><b style={{ color: "var(--ink)" }}>{mySets.length}</b> set</span>
            <span><b style={{ color: "var(--ink)" }}>{totalParts.toLocaleString("tr-TR")}</b> parça</span>
            <span><b style={{ color: "var(--ink)" }}>{totalFigs}</b> minifigür</span>
          </div>

          {/* hesaplanan rozetler — şema gerektirmez, veriden türetilir */}
          {(() => {
            const badges: [string, string][] = [];
            if (u.createdAt < new Date("2026-10-01"))
              badges.push(["🧡 Kurucu Üye", "Beta döneminde aramıza katıldı"]);
            if (mySets.length >= 100) badges.push(["💯 100 Set Kulübü", "Koleksiyonunda 100+ set"]);
            else if (mySets.length >= 25) badges.push(["🏗️ Usta Koleksiyoncu", "Koleksiyonunda 25+ set"]);
            if (totalParts >= 100_000) badges.push(["🧱 Parça Milyoneri Yolunda", "100.000+ parça"]);
            if (totalFigs >= 50) badges.push(["🧍 Minifigür Ordusu", "50+ minifigür"]);
            if (sStats.soldCount >= 1) badges.push(["🤝 İlk Satış", "JestBrick'te satış yaptı"]);
            if (sStats.avgScore != null && sStats.avgScore >= 4.5 && sStats.ratingCount >= 3)
              badges.push(["⭐ Güvenilir Satıcı", "4,5+ puan, 3+ değerlendirme"]);
            if (badges.length === 0) return null;
            return (
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                {badges.map(([label, title]) => (
                  <span key={label} className="chip" title={title} style={{ fontSize: 12.5, background: "var(--yellow-soft)", borderColor: "var(--yellow-d)" }}>
                    {label}
                  </span>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      {mySets.length > 0 && (
        <>
          <h2 style={{ fontFamily: "var(--disp)", fontSize: 18, fontWeight: 800, margin: "26px 0 12px" }}>
            Koleksiyon ({mySets.length})
          </h2>
          <div className="setgrid">
            {mySets.map((s) => (
              <Link key={s.setNum} href={`/setler/${s.setNum}`} className="setcard">
                <div className="img">
                  {(s.imagePath ?? s.imageUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.imagePath ?? s.imageUrl ?? ""} alt={s.name} loading="lazy" />
                  ) : (
                    <span style={{ fontSize: 40 }}>🧱</span>
                  )}
                </div>
                <div className="meta">
                  <b>{s.name}</b>
                  <small>
                    #{s.setNum.replace(/-1$/, "")} · {s.themeName ?? "—"} · {s.numParts.toLocaleString("tr-TR")} parça
                  </small>
                  <small style={{ display: "block", marginTop: 3 }}>
                    {s.condition === "sealed" ? "📦 Kapalı kutu" : s.condition === "parts" ? "🧩 Parçalarına ayrık" : "🧱 Kurulu"}
                    {s.note ? ` · ${s.note}` : ""}
                  </small>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {figs.length > 0 && (
        <>
          <h2 style={{ fontFamily: "var(--disp)", fontSize: 18, fontWeight: 800, margin: "26px 0 12px" }}>
            Minifigürler ({totalFigs})
          </h2>
          <div className="setgrid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }}>
            {figs.slice(0, 18).map((f) => (
              <div key={f.figNum} className="setcard">
                <div className="img" style={{ height: 110 }}>
                  {f.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.imageUrl} alt={f.name} loading="lazy" />
                  ) : (
                    <span style={{ fontSize: 32 }}>🙂</span>
                  )}
                </div>
                <div className="meta">
                  <b style={{ fontSize: 12.5 }}>
                    {f.name}
                    {f.total > 1 ? ` ×${f.total}` : ""}
                  </b>
                </div>
              </div>
            ))}
          </div>
          {figs.length > 18 && (
            <p style={{ color: "var(--ink3)", fontSize: 13, marginTop: 10 }}>+{figs.length - 18} minifigür daha</p>
          )}
        </>
      )}

      {wishSets.length > 0 && (
        <>
          <h2 style={{ fontFamily: "var(--disp)", fontSize: 18, fontWeight: 800, margin: "26px 0 12px" }}>
            İstek Listesi ({wishSets.length})
          </h2>
          <div className="setgrid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
            {wishSets.map((s) => (
              <Link key={s.setNum} href={`/setler/${s.setNum}`} className="setcard">
                <div className="img" style={{ height: 110 }}>
                  {(s.imagePath ?? s.imageUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.imagePath ?? s.imageUrl ?? ""} alt={s.name} loading="lazy" />
                  ) : (
                    <span style={{ fontSize: 32 }}>🧱</span>
                  )}
                </div>
                <div className="meta">
                  <b style={{ fontSize: 13 }}>☆ {s.name}</b>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {mySets.length === 0 && figs.length === 0 && (
        <div className="notice" style={{ marginTop: 20 }}>Bu üyenin vitrini henüz boş.</div>
      )}

      {myListings.length > 0 && (
        <>
          <h2 style={{ fontFamily: "var(--disp)", fontSize: 18, fontWeight: 800, margin: "26px 0 12px" }}>
            🏷️ Satıştaki İlanları ({myListings.length})
          </h2>
          <div className="setgrid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
            {myListings.map((l) => (
              <Link key={l.id} href={`/pazar/${l.id}`} className="setcard">
                <div className="img" style={{ height: 110 }}>
                  {(l.imagePath ?? l.imageUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.imagePath ?? l.imageUrl ?? ""} alt={l.setName} loading="lazy" />
                  ) : (
                    <span style={{ fontSize: 32 }}>🧱</span>
                  )}
                </div>
                <div className="meta">
                  <b style={{ fontSize: 13 }}>{l.setName}</b>
                  <small>
                    <b style={{ color: "var(--ink)" }}>{Number(l.priceTry).toLocaleString("tr-TR")} ₺</b>
                    {l.status === "reserved" ? " · rezerve" : ""}
                  </small>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {(sStats.ratingCount > 0 || sStats.soldCount > 0) && (
        <>
          <h2 style={{ fontFamily: "var(--disp)", fontSize: 18, fontWeight: 800, margin: "26px 0 12px" }}>
            ⭐ Satıcı Karnesi
            {sStats.avgScore != null && (
              <span style={{ fontSize: 14, color: "var(--ink2)", fontWeight: 600, marginLeft: 10 }}>
                {sStats.avgScore.toFixed(1)} / 5 · {sStats.ratingCount} değerlendirme · {sStats.soldCount} satış
              </span>
            )}
          </h2>
          {ratings.length > 0 && (
            <div className="card" style={{ padding: 0 }}>
              {ratings.map((r) => (
                <div key={r.id} style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", fontSize: 13.5 }}>
                  <b>{"⭐".repeat(r.score)}</b>
                  {r.comment && <span style={{ marginLeft: 8 }}>{r.comment}</span>}
                  <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 2 }}>
                    @{r.raterHandle} · {timeAgo(r.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!viewer && (
        <div
          className="card"
          style={{ marginTop: 28, padding: "22px 26px", textAlign: "center", background: "var(--yellow-soft)" }}
        >
          <b style={{ fontFamily: "var(--disp)", fontSize: 17 }}>
            Sen de koleksiyonunu sergile 🧱
          </b>
          <p style={{ fontSize: 14, color: "var(--ink2)", margin: "8px 0 14px" }}>
            Setlerini kataloglara, minifigürlerini vitrine ekle; seti olanla arayanı JestBrick buluştursun.
          </p>
          <Link href={`/kayit?sonra=/u/${u.handle}`} className="btn btn-y">
            Ücretsiz Katıl
          </Link>
        </div>
      )}
    </main>
  );
}
