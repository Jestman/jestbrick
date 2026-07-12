import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db, envReady, schema } from "@/db";
import { flagEnabled } from "@/lib/settings";
import { getUser } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/format";

export const metadata = { title: "Forum" };

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
      // NOT: alt sorguda kolonlar elle nitelenmeli — ${schema.x.y} niteliksiz "y"
      // basar ve alt sorgunun kendi tablosuna çözülür (yanlış/tip hatası).
      topicCount: sql<number>`(select count(*)::int from topics t where t.category_id = forum_categories.id)`,
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
      categoryIcon: schema.forumCategories.icon,
      categoryName: schema.forumCategories.name,
      authorHandle: schema.users.handle,
      authorName: schema.users.displayName,
      replyCount: sql<number>`(select count(*)::int - 1 from topic_posts tp where tp.topic_id = topics.id)`,
    })
    .from(schema.topics)
    .innerJoin(schema.forumCategories, eq(schema.topics.categoryId, schema.forumCategories.id))
    .innerJoin(schema.users, eq(schema.topics.authorId, schema.users.id))
    .where(activeCat ? eq(schema.topics.categoryId, activeCat.id) : undefined)
    .orderBy(desc(schema.topics.pinned), desc(schema.topics.lastPostAt))
    .limit(40);

  return (
    <main className="wrap" style={{ maxWidth: 820 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <h1 className="page" style={{ marginBottom: 0 }}>Forum</h1>
        {user && (
          <Link href={`/forum/yeni${activeCat ? `?k=${activeCat.slug}` : ""}`} className="btn btn-y">
            + Yeni Başlık
          </Link>
        )}
      </div>

      {/* kategori şeritleri */}
      <div style={{ display: "flex", gap: 8, margin: "16px 0 20px", flexWrap: "wrap" }}>
        <Link href="/forum" className="chip" style={!activeCat ? { background: "var(--yellow)", borderColor: "var(--yellow)" } : undefined}>
          Tümü
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/forum?k=${c.slug}`}
            className="chip"
            title={c.description}
            style={activeCat?.id === c.id ? { background: "var(--yellow)", borderColor: "var(--yellow)" } : undefined}
          >
            {c.icon} {c.name} <span style={{ color: "var(--ink3)" }}>({c.topicCount})</span>
          </Link>
        ))}
      </div>

      {topics.length === 0 ? (
        <div className="notice">
          {activeCat ? `${activeCat.name} kategorisinde henüz başlık yok.` : "Henüz başlık yok."}{" "}
          {user ? "İlk başlığı sen aç!" : ""}
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {topics.map((t) => (
            <Link
              key={t.id}
              href={`/forum/konu/${t.id}`}
              style={{
                display: "flex", gap: 12, padding: "14px 18px", alignItems: "center",
                borderBottom: "1px solid var(--line)", color: "inherit",
              }}
            >
              <span style={{ fontSize: 20, flex: "none" }}>{t.categoryIcon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 14.5 }}>
                  {t.pinned && "📌 "}
                  {t.locked && "🔒 "}
                  {t.title}
                </b>
                <div style={{ fontSize: 12.5, color: "var(--ink3)", marginTop: 2 }}>
                  {t.categoryName} · {t.authorName || t.authorHandle} · {timeAgo(t.lastPostAt)}
                </div>
              </div>
              <span style={{ fontSize: 12.5, color: "var(--ink3)", flex: "none" }}>
                💬 {t.replyCount}
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
