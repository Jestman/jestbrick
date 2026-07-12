import { notFound } from "next/navigation";
import Link from "next/link";
import { and, asc, count, eq, sql } from "drizzle-orm";
import { db, envReady, schema } from "@/db";
import { getUser } from "@/lib/supabase/server";
import { follow, unfollow } from "@/lib/social/actions";
import { Avatar, RoleBadge } from "@/app/components/Avatar";
import { avatarHue } from "@/lib/format";
import { mediaUrl } from "@/lib/media";

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

  return (
    <main className="wrap" style={{ maxWidth: 860 }}>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ height: 120, background: `linear-gradient(120deg, hsl(${hue}, 45%, 30%), var(--ink))` }} />
        <div style={{ padding: "0 24px 22px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
            <div style={{ marginTop: -42, border: "4px solid #fff", borderRadius: "50%", lineHeight: 0 }}>
              <Avatar handle={u.handle} name={u.displayName} size={84} src={mediaUrl(u.avatarPath)} />
            </div>
            <div style={{ marginLeft: "auto", paddingTop: 12 }}>
              {isMe ? (
                <Link href="/hesap/profil" className="btn btn-o">Profili Düzenle</Link>
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
                <Link href={`/giris?sonra=/u/${u.handle}`} className="btn btn-y">Takip Et</Link>
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
    </main>
  );
}
