import Link from "next/link";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db, envReady, schema } from "@/db";
import { getUser } from "@/lib/supabase/server";
import { toggleLike, addComment, createPost } from "@/lib/social/actions";
import { Avatar, RoleBadge } from "@/app/components/Avatar";
import { timeAgo } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import { HomeSide } from "./HomeSide";
import { PendingButton } from "./components/PendingButton";

async function LandingStats() {
  const [row] = await db()
    .select({
      members: sql<number>`(select count(*)::int from users)`,
      sets: sql<number>`(select count(*)::int from sets)`,
      listings: sql<number>`(select count(*)::int from listings where status = 'active')`,
      figs: sql<number>`(select count(*)::int from minifigs)`,
    })
    .from(sql`(select 1) as one`);
  const items: [string, string][] = [
    [row.members.toLocaleString("tr-TR"), "koleksiyoncu"],
    [row.sets.toLocaleString("tr-TR"), "set katalogda"],
    [row.figs.toLocaleString("tr-TR"), "minifigür"],
    [row.listings.toLocaleString("tr-TR"), "aktif ilan"],
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, margin: "8px 0 34px" }}>
      {items.map(([n, label]) => (
        <div key={label} className="card" style={{ padding: "14px 10px", textAlign: "center" }}>
          <b style={{ fontFamily: "var(--disp)", fontSize: 22 }}>{n}</b>
          <div style={{ fontSize: 12.5, color: "var(--ink3)" }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

function Landing() {
  return (
    <main className="wrap" style={{ maxWidth: 860 }}>
      <div style={{ padding: "44px 0 28px", textAlign: "center" }}>
        <h1
          style={{
            fontFamily: "var(--disp)", fontSize: "clamp(28px, 5vw, 42px)", fontWeight: 800,
            letterSpacing: "-0.8px", lineHeight: 1.15, textWrap: "balance",
          }}
        >
          Koleksiyonunu sergile.
          <br />
          Seti olanla arayanı buluştur.
        </h1>
        <p style={{ color: "var(--ink2)", margin: "14px auto 0", maxWidth: "52ch", fontSize: 16 }}>
          JestBrick, LEGO koleksiyoncularının buluşma noktası: koleksiyon vitrini, istek listesi
          eşleştirme, forum ve güvenli ikinci el pazarı — hepsi tek yerde.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 26, flexWrap: "wrap", justifyContent: "center" }}>
          <Link href="/kayit" className="btn btn-y">🧱 Aramıza Katıl</Link>
          <Link href="/setler" className="btn btn-o">Set Kataloğuna Göz At</Link>
        </div>
      </div>

      {!envReady() ? (
        <div className="notice">
          <b>Kurulum bekleniyor:</b> <code>.env.local</code> dosyası eksik — <code>README.md</code>
          &nbsp;adımlarını izle.
        </div>
      ) : (
        <>
          <LandingStats />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14, marginBottom: 34 }}>
            {[
              ["🧱", "Vitrinini kur", "Setlerini ve minifigürlerini katalogdan tek tıkla ekle; profilin paylaşılabilir bir koleksiyon vitrinine dönüşsün."],
              ["🔥", "Eşleş", "İstek listeni aç — aradığın seti satan çıkınca bildirim gelir; elindekini arayanlara tek tıkla ulaş."],
              ["🤝", "Güvenle alışveriş yap", "Koleksiyoncudan koleksiyoncuya pazar, satıcı puanlarıyla. Forumda fiyat ve emeklilik sohbetleri cabası."],
            ].map(([icon, title, desc]) => (
              <div key={title} className="card" style={{ padding: "18px 20px" }}>
                <span style={{ fontSize: 26 }}>{icon}</span>
                <b style={{ display: "block", fontFamily: "var(--disp)", fontSize: 15.5, margin: "8px 0 5px" }}>{title}</b>
                <p style={{ fontSize: 13.5, color: "var(--ink2)", lineHeight: 1.55 }}>{desc}</p>
              </div>
            ))}
          </div>

          <div className="home-grid">
            <div className="card studs" style={{ padding: "22px 26px", textAlign: "center", background: "var(--yellow-soft)", alignSelf: "stretch" }}>
              <b style={{ fontFamily: "var(--disp)", fontSize: 17 }}>Topluluk şimdiden dönüyor 🧱</b>
              <p style={{ fontSize: 14, color: "var(--ink2)", margin: "8px 0 14px" }}>
                Yandakiler canlı: ilanlar, forum konuları, yeni katılanlar. Sen de yerini al.
              </p>
              <Link href="/kayit" className="btn btn-y">Ücretsiz Katıl</Link>
            </div>
            <HomeSide />
          </div>
        </>
      )}
    </main>
  );
}

function Composer({ me }: { me: { handle: string; name: string; avatar: string | null } }) {
  return (
    <form action={createPost} className="card" style={{ marginBottom: 18, padding: "16px 18px" }}>
      <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
        <Avatar handle={me.handle} name={me.name} size={42} src={me.avatar} />
        <textarea
          name="body"
          placeholder="Koleksiyonunda neler oluyor?"
          maxLength={2000}
          style={{
            flex: 1, border: "1.5px solid var(--line)", borderRadius: 12, padding: "10px 14px",
            outline: "none", resize: "vertical", minHeight: 56, background: "var(--soft)",
          }}
        />
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink2)", cursor: "pointer", flex: 1, minWidth: 200 }}>
          📷 Fotoğraf ekle (en fazla 4)
          <input type="file" name="photos" accept="image/*" multiple style={{ display: "block", fontSize: 12, marginTop: 4, width: "100%" }} />
        </label>
        <PendingButton style={{ marginLeft: "auto" }} pendingText="Paylaşılıyor…">
          Paylaş
        </PendingButton>
      </div>
    </form>
  );
}

async function Feed({ userId }: { userId: string }) {
  const followed = await db()
    .select({ id: schema.follows.followeeId })
    .from(schema.follows)
    .where(eq(schema.follows.followerId, userId));
  const authorIds = [...followed.map((f) => f.id), userId];

  const posts = await db()
    .select({
      id: schema.posts.id,
      kind: schema.posts.kind,
      body: schema.posts.body,
      likeCount: schema.posts.likeCount,
      createdAt: schema.posts.createdAt,
      authorHandle: schema.users.handle,
      authorName: schema.users.displayName,
      authorRole: schema.users.role,
      authorAvatar: schema.users.avatarPath,
      setNum: schema.sets.setNum,
      setName: schema.sets.name,
      setParts: schema.sets.numParts,
      setImg: sql<string | null>`coalesce(${schema.sets.imagePath}, ${schema.sets.imageUrl})`,
      themeName: schema.themes.name,
      likedByMe: sql<boolean>`exists (
        select 1 from likes l where l.post_id = ${schema.posts.id} and l.user_id = ${userId}
      )`,
    })
    .from(schema.posts)
    .innerJoin(schema.users, eq(schema.posts.authorId, schema.users.id))
    .leftJoin(schema.sets, eq(schema.posts.setNum, schema.sets.setNum))
    .leftJoin(schema.themes, eq(schema.sets.themeId, schema.themes.id))
    .where(inArray(schema.posts.authorId, authorIds))
    .orderBy(desc(schema.posts.createdAt))
    .limit(50);

  const postIds = posts.map((p) => p.id);
  const [mediaRows, commentRows] = postIds.length
    ? await Promise.all([
        db()
          .select({
            postId: schema.postMedia.postId,
            storagePath: schema.postMedia.storagePath,
            position: schema.postMedia.position,
          })
          .from(schema.postMedia)
          .where(inArray(schema.postMedia.postId, postIds))
          .orderBy(asc(schema.postMedia.position)),
        db()
          .select({
            id: schema.comments.id,
            postId: schema.comments.postId,
            body: schema.comments.body,
            createdAt: schema.comments.createdAt,
            handle: schema.users.handle,
            name: schema.users.displayName,
            avatar: schema.users.avatarPath,
          })
          .from(schema.comments)
          .innerJoin(schema.users, eq(schema.comments.authorId, schema.users.id))
          .where(inArray(schema.comments.postId, postIds))
          .orderBy(asc(schema.comments.createdAt)),
      ])
    : [[], []];

  const mediaByPost = new Map<string, string[]>();
  for (const m of mediaRows) {
    const arr = mediaByPost.get(m.postId) ?? [];
    const url = mediaUrl(m.storagePath);
    if (url) arr.push(url);
    mediaByPost.set(m.postId, arr);
  }
  const commentsByPost = new Map<string, typeof commentRows>();
  for (const c of commentRows) {
    const arr = commentsByPost.get(c.postId) ?? [];
    arr.push(c);
    commentsByPost.set(c.postId, arr);
  }

  if (posts.length === 0) {
    return (
      <div className="notice">
        Akışın henüz boş. <Link href="/uyeler">Üyeleri keşfet</Link> ve takip et — ya da yukarıdan
        ilk paylaşımını yap!
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {posts.map((p) => {
        const photos = mediaByPost.get(p.id) ?? [];
        const comments = commentsByPost.get(p.id) ?? [];
        return (
          <article key={p.id} className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "14px 18px 10px" }}>
              <Link href={`/u/${p.authorHandle}`}>
                <Avatar handle={p.authorHandle} name={p.authorName} size={42} src={mediaUrl(p.authorAvatar)} />
              </Link>
              <div>
                <span style={{ fontWeight: 700, fontSize: 14.5, display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
                  <Link href={`/u/${p.authorHandle}`} style={{ color: "inherit" }}>
                    {p.authorName || p.authorHandle}
                  </Link>
                  <RoleBadge role={p.authorRole} />
                  {p.kind === "collection_add" && (
                    <span style={{ color: "var(--ink3)", fontWeight: 500 }}>koleksiyonuna ekledi</span>
                  )}
                </span>
                <div style={{ fontSize: 12.5, color: "var(--ink3)" }}>
                  @{p.authorHandle} · {timeAgo(p.createdAt)}
                </div>
              </div>
            </div>

            {p.body && <p style={{ padding: "0 18px 12px", whiteSpace: "pre-line" }}>{p.body}</p>}

            {photos.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: photos.length > 1 ? "1fr 1fr" : "1fr",
                  gap: 3,
                  background: "var(--soft)",
                  borderTop: "1px solid var(--line)",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                {photos.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={url}
                    alt=""
                    loading="lazy"
                    style={{ width: "100%", maxHeight: photos.length > 1 ? 240 : 420, objectFit: "cover", display: "block" }}
                  />
                ))}
              </div>
            )}

            {p.setNum && (
              <Link href={`/setler/${p.setNum}`} style={{ color: "inherit", display: "block" }}>
                <div
                  style={{
                    display: "flex", gap: 16, alignItems: "center", background: "var(--soft)",
                    borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", padding: "12px 18px",
                  }}
                >
                  {p.setImg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.setImg} alt={p.setName ?? ""} style={{ width: 110, height: 80, objectFit: "contain", flex: "none" }} />
                  ) : (
                    <span style={{ fontSize: 40 }}>🧱</span>
                  )}
                  <div>
                    <b style={{ fontSize: 15 }}>{p.setName}</b>
                    <div style={{ fontSize: 12.5, color: "var(--ink3)" }}>
                      #{p.setNum.replace(/-1$/, "")} · {p.themeName ?? "—"} ·{" "}
                      {(p.setParts ?? 0).toLocaleString("tr-TR")} parça
                    </div>
                  </div>
                </div>
              </Link>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px 4px" }}>
              <form action={toggleLike}>
                <input type="hidden" name="postId" value={p.id} />
                <button
                  type="submit"
                  style={{
                    display: "flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 9,
                    border: "none", background: "none", fontWeight: 600, fontSize: 13.5,
                    color: p.likedByMe ? "var(--red)" : "var(--ink2)",
                  }}
                >
                  {p.likedByMe ? "❤️" : "🤍"} {p.likeCount > 0 ? p.likeCount : ""} Beğen
                </button>
              </form>
              <span style={{ fontSize: 13, color: "var(--ink3)" }}>
                {comments.length > 0 ? `${comments.length} yorum` : ""}
              </span>
            </div>

            {comments.length > 0 && (
              <div style={{ padding: "4px 18px 6px", display: "flex", flexDirection: "column", gap: 9 }}>
                {comments.slice(-3).map((c) => (
                  <div key={c.id} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                    <Link href={`/u/${c.handle}`}>
                      <Avatar handle={c.handle} name={c.name} size={28} src={mediaUrl(c.avatar)} />
                    </Link>
                    <div style={{ background: "var(--soft)", borderRadius: 12, padding: "7px 12px", fontSize: 13.5 }}>
                      <Link href={`/u/${c.handle}`} style={{ color: "inherit", fontWeight: 700, fontSize: 13 }}>
                        {c.name || c.handle}
                      </Link>{" "}
                      {c.body}
                    </div>
                  </div>
                ))}
                {comments.length > 3 && (
                  <span style={{ fontSize: 12.5, color: "var(--ink3)" }}>+{comments.length - 3} yorum daha</span>
                )}
              </div>
            )}

            <form action={addComment} style={{ display: "flex", gap: 9, alignItems: "center", padding: "6px 18px 14px" }}>
              <input type="hidden" name="postId" value={p.id} />
              <input
                name="body"
                placeholder="Yorum yaz…"
                maxLength={1000}
                autoComplete="off"
                style={{
                  flex: 1, background: "var(--soft)", border: "1px solid var(--line)",
                  borderRadius: 99, padding: "8px 14px", outline: "none",
                }}
              />
              <PendingButton style={{ padding: "7px 14px", fontSize: 13 }} pendingText="…">
                Gönder
              </PendingButton>
            </form>
          </article>
        );
      })}
    </div>
  );
}

/** Yeni üye pusulası: 3 adımlık başlangıç kartı — hepsi bitince kaybolur. */
async function OnboardingCard({ userId, handle }: { userId: string; handle: string }) {
  const [row] = await db()
    .select({
      sets: sql<number>`(select count(*)::int from collection_items ci where ci.user_id = ${userId})`,
      wishes: sql<number>`(select count(*)::int from wishlist_items wi where wi.user_id = ${userId})`,
      profileDone: sql<boolean>`(select (u.bio <> '' or u.avatar_path is not null) from users u where u.id = ${userId})`,
    })
    .from(sql`(select 1) as one`);
  const steps: [boolean, string, string][] = [
    [row.sets > 0, "İlk setini koleksiyonuna ekle", "/setler"],
    [row.wishes > 0, "İstek listene bir set koy — eşleşince haber verelim", "/setler"],
    [row.profileDone, "Profilini doldur (fotoğraf + birkaç satır)", "/hesap/profil"],
  ];
  const done = steps.filter(([ok]) => ok).length;
  if (done === steps.length) return null;

  return (
    <div className="card" style={{ marginBottom: 18, padding: "16px 20px", borderLeft: "5px solid var(--yellow)" }}>
      <b style={{ fontFamily: "var(--disp)", fontSize: 15 }}>
        Hoş geldin! Vitrinini kur ({done}/{steps.length})
      </b>
      <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 10 }}>
        {steps.map(([ok, label, href]) => (
          <Link
            key={label}
            href={href}
            style={{
              display: "flex", gap: 9, alignItems: "center", fontSize: 13.5, color: "inherit",
              textDecoration: ok ? "line-through" : undefined, opacity: ok ? 0.55 : 1,
            }}
          >
            <span>{ok ? "✅" : "⬜"}</span> {label}
          </Link>
        ))}
        <Link href={`/u/${handle}`} style={{ fontSize: 12.5, fontWeight: 600, marginTop: 4 }}>
          Vitrinim nasıl görünüyor? →
        </Link>
      </div>
    </div>
  );
}

export default async function Home() {
  if (!envReady()) return <Landing />;
  const user = await getUser();
  if (!user) return <Landing />;

  const meRows = await db()
    .select({
      handle: schema.users.handle,
      name: schema.users.displayName,
      avatar: schema.users.avatarPath,
    })
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .limit(1);
  const me = meRows[0] ?? { handle: "ben", name: "", avatar: null };

  return (
    <main className="wrap" style={{ maxWidth: 1000 }}>
      <div className="home-grid">
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 18 }}>
            <h1 className="page" style={{ marginBottom: 0 }}>Akış</h1>
            <Link href="/uyeler" style={{ fontSize: 13.5, fontWeight: 600, marginLeft: "auto" }}>
              Üyeleri keşfet →
            </Link>
          </div>
          <OnboardingCard userId={user.id} handle={me.handle} />
          <Composer me={{ handle: me.handle, name: me.name, avatar: mediaUrl(me.avatar) }} />
          <Feed userId={user.id} />
        </div>
        <HomeSide />
      </div>
    </main>
  );
}
