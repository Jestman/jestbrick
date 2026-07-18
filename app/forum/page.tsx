import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db, envReady, schema } from "@/db";
import { flagEnabled } from "@/lib/settings";
import { getUser } from "@/lib/supabase/server";
import { Avatar } from "@/app/components/Avatar";
import { timeAgo } from "@/lib/format";
import { mediaUrl } from "@/lib/media";

export const metadata = {
  title: "Forum — LEGO Sohbetleri",
  description:
    "Yeni setler, koleksiyon ve yatırım, MOC teknikleri, alım-satım rehberi — Türkiye'nin LEGO koleksiyoncu forumu.",
};

export default async function ForumPage({
  searchParams,
}: {
  searchParams: Promise<{ k?: string }>;
}) {
  if (!envReady()) redirect("/");
  if (!(await flagEnabled("forum_enabled"))) redirect("/");
  const { k } = await searchParams;
  const user = await getUser();

  const categories = await db()
    .select({
      id: schema.forumCategories.id,
      name: schema.forumCategories.name,
      slug: schema.forumCategories.slug,
      icon: schema.forumCategories.icon,
      description: schema.forumCategories.description,
      topicCount: sql<number>`(select count(*)::int from topics t where t.category_id = forum_categories.id)`,
      postCount: sql<number>`(select count(*)::int from topic_posts tp join topics t on t.id = tp.topic_id where t.category_id = forum_categories.id)`,
      lastPostAt: sql<string | null>`(select max(t.last_post_at) from topics t where t.category_id = forum_categories.id)`,
    })
    .from(schema.forumCategories)
    .orderBy(asc(schema.forumCategories.position));

  const activeCat = k ? categories.find((c) => c.slug === k) : undefined;

  const topics = await db()
    .select({
      id: schema.topics.id,
      title: schema.topics.title,
      pinned: schema.topics.pinned,
      locked: schema.topics.locked,
      lastPostAt: schema.topics.lastPostAt,
      createdAt: schema.topics.createdAt,
      categoryIcon: schema.forumCategories.icon,
      categoryName: schema.forumCategories.name,
      categorySlug: schema.forumCategories.slug,
      authorHandle: schema.users.handle,
      authorName: schema.users.displayName,
      authorAvatar: schema.users.avatarPath,
      replyCount: sql<number>`(select count(*)::int - 1 from topic_posts tp where tp.topic_id = topics.id)`,
      lastPoster: sql<string | null>`(select u2.display_name from topic_posts tp
        join users u2 on u2.id = tp.author_id
        where tp.topic_id = topics.id order by tp.created_at desc limit 1)`,
    })
    .from(schema.topics)
    .innerJoin(schema.forumCategories, eq(schema.topics.categoryId, schema.forumCategories.id))
    .innerJoin(schema.users, eq(schema.topics.authorId, schema.users.id))
    .where(activeCat ? eq(schema.topics.categoryId, activeCat.id) : undefined)
    .orderBy(desc(schema.topics.pinned), desc(schema.topics.lastPostAt))
    .limit(40);

  return (
    <main className="wrap" style={{ maxWidth: 980 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
        <div>
          <h1 className="page" style={{ marginBottom: 2 }}>Forum</h1>
          <p style={{ fontSize: 13.5, color: "var(--ink2)" }}>
            Türkiye'nin LEGO koleksiyoncu topluluğu — sor, paylaş, tartış.
          </p>
        </div>
        {user && (
          <Link href={`/forum/yeni${activeCat ? `?k=${activeCat.slug}` : ""}`} className="btn btn-y">
            ✏️ Yeni Başlık
          </Link>
        )}
      </div>

      {/* kategori panosu */}
      {!activeCat && (
        <div className="forum-cats">
          {categories.map((c) => (
            <Link key={c.id} href={`/forum?k=${c.slug}`} className="forum-cat card">
              <span className="fc-icon">{c.icon}</span>
              <span className="fc-body">
                <b>{c.name}</b>
                <small>{c.description}</small>
              </span>
              <span className="fc-stats">
                <b>{c.topicCount}</b> başlık
                <small>{c.postCount} mesaj</small>
                {c.lastPostAt && <small>son: {timeAgo(new Date(c.lastPostAt))}</small>}
              </span>
            </Link>
          ))}
        </div>
      )}

      {activeCat && (
        <div className="card" style={{ display: "flex", gap: 14, alignItems: "center", padding: "14px 18px", marginBottom: 16 }}>
          <span style={{ fontSize: 30 }}>{activeCat.icon}</span>
          <div style={{ flex: 1 }}>
            <b style={{ fontFamily: "var(--disp)", fontSize: 16 }}>{activeCat.name}</b>
            <div style={{ fontSize: 13, color: "var(--ink2)" }}>{activeCat.description}</div>
          </div>
          <Link href="/forum" style={{ fontSize: 13, fontWeight: 600, flex: "none" }}>
            ← Tüm kategoriler
          </Link>
        </div>
      )}

      {/* başlık listesi */}
      <h2 style={{ fontFamily: "var(--disp)", fontSize: 16, fontWeight: 800, margin: "22px 0 10px" }}>
        {activeCat ? `${activeCat.name} başlıkları` : "Son konuşulanlar"}
      </h2>
      {topics.length === 0 ? (
        <div className="notice">
          {activeCat ? `${activeCat.name} kategorisinde henüz başlık yok.` : "Henüz başlık yok."}{" "}
          {user ? "İlk başlığı sen aç!" : ""}
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {topics.map((t) => (
            <div key={t.id} className="topic-row">
              <Link href={`/u/${t.authorHandle}`} style={{ flex: "none", lineHeight: 0 }}>
                <Avatar handle={t.authorHandle} name={t.authorName} size={38} src={mediaUrl(t.authorAvatar)} />
              </Link>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link href={`/forum/konu/${t.id}`} style={{ color: "inherit", fontWeight: 700, fontSize: 14.5, display: "block" }}>
                  {t.pinned && "📌 "}
                  {t.locked && "🔒 "}
                  {t.title}
                </Link>
                <div style={{ fontSize: 12.5, color: "var(--ink3)", marginTop: 2, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {!activeCat && (
                    <Link href={`/forum?k=${t.categorySlug}`} style={{ color: "var(--blue)", fontWeight: 600 }}>
                      {t.categoryIcon} {t.categoryName}
                    </Link>
                  )}
                  <span>{t.authorName || t.authorHandle} açtı · {timeAgo(t.createdAt)}</span>
                </div>
              </div>
              <div className="topic-stats">
                <b>{t.replyCount}</b>
                <small>yanıt</small>
              </div>
              <div className="topic-last">
                <small>son mesaj</small>
                <b>{t.lastPoster ?? "—"}</b>
                <small>{timeAgo(t.lastPostAt)}</small>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
