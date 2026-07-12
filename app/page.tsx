import Link from "next/link";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db, envReady, schema } from "@/db";
import { getUser } from "@/lib/supabase/server";
import { toggleLike } from "@/lib/social/actions";
import { Avatar, RoleBadge } from "@/app/components/Avatar";
import { timeAgo } from "@/lib/format";

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

  if (posts.length === 0) {
    return (
      <div className="notice">
        Akışın henüz boş. <Link href="/uyeler">Üyeleri keşfet</Link> ve takip et — ya da{" "}
        <Link href="/setler">kataloğdan</Link> koleksiyonuna set ekle, takipçilerin akışında görünsün.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {posts.map((p) => (
        <article key={p.id} className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "14px 18px 10px" }}>
            <Link href={`/u/${p.authorHandle}`}>
              <Avatar handle={p.authorHandle} name={p.authorName} size={42} />
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

          {p.body && <p style={{ padding: "0 18px 12px" }}>{p.body}</p>}

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

          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px" }}>
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
          </div>
        </article>
      ))}
    </div>
  );
}

export default async function Home() {
  if (!envReady()) return <Landing />;
  const user = await getUser();
  if (!user) return <Landing />;

  return (
    <main className="wrap" style={{ maxWidth: 640 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 18 }}>
        <h1 className="page" style={{ marginBottom: 0 }}>Akış</h1>
        <Link href="/uyeler" style={{ fontSize: 13.5, fontWeight: 600, marginLeft: "auto" }}>
          Üyeleri keşfet →
        </Link>
      </div>
      <Feed userId={user.id} />
    </main>
  );
}
