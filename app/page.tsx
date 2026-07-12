import Link from "next/link";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db, envReady, schema } from "@/db";
import { getUser } from "@/lib/supabase/server";
import { toggleLike, addComment, createPost } from "@/lib/social/actions";
import { Avatar, RoleBadge } from "@/app/components/Avatar";
import { timeAgo } from "@/lib/format";
import { mediaUrl } from "@/lib/media";

function Landing() {
  return (
    <main className="wrap" style={{ maxWidth: 720 }}>
      <div style={{ padding: "48px 0 32px" }}>
        <h1
          style={{
            fontFamily: "var(--disp)", fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 800,
            letterSpacing: "-0.8px", lineHeight: 1.15, textWrap: "balance",
          }}
        >
          Koleksiyonunu sergile.
          <br />
          Seti olanla arayanı buluştur.
        </h1>
        <p style={{ color: "var(--ink2)", marginTop: 14, maxWidth: "52ch", fontSize: 16 }}>
          JestBrick, LEGO koleksiyoncularının buluşma noktası: koleksiyon vitrini, istek listesi
          eşleştirme, forum ve güvenli ikinci el pazarı — hepsi tek yerde.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 26, flexWrap: "wrap" }}>
          <Link href="/kayit" className="btn btn-y">🧱 Aramıza Katıl</Link>
          <Link href="/setler" className="btn btn-o">Set Kataloğuna Göz At</Link>
        </div>
      </div>
      {!envReady() && (
        <div className="notice">
          <b>Kurulum bekleniyor:</b> <code>.env.local</code> dosyası eksik — <code>README.md</code>
          &nbsp;adımlarını izle.
        </div>
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
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, paddingLeft: 53 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink2)", cursor: "pointer" }}>
          📷 Fotoğraf ekle (en fazla 4)
          <input type="file" name="photos" accept="image/*" multiple style={{ display: "block", fontSize: 12, marginTop: 4 }} />
        </label>
        <button className="btn btn-y" type="submit" style={{ marginLeft: "auto" }}>
          Paylaş
        </button>
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
              <button className="btn btn-y" type="submit" style={{ padding: "7px 14px", fontSize: 13 }}>
                Gönder
              </button>
            </form>
          </article>
        );
      })}
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
    <main className="wrap" style={{ maxWidth: 640 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 18 }}>
        <h1 className="page" style={{ marginBottom: 0 }}>Akış</h1>
        <Link href="/uyeler" style={{ fontSize: 13.5, fontWeight: 600, marginLeft: "auto" }}>
          Üyeleri keşfet →
        </Link>
      </div>
      <Composer me={{ handle: me.handle, name: me.name, avatar: mediaUrl(me.avatar) }} />
      <Feed userId={user.id} />
    </main>
  );
}
