import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { Avatar } from "@/app/components/Avatar";
import { timeAgo } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import { getFlags } from "@/lib/settings";

/** Ana sayfa yan paneli: yeni ilanlar, popüler forum, yeni üyeler. */
export async function HomeSide() {
  const flags = await getFlags();
  const [listings, topics, newUsers] = await Promise.all([
    flags.market_enabled
      ? db()
          .select({
            id: schema.listings.id,
            priceTry: schema.listings.priceTry,
            setName: schema.sets.name,
            img: sql<string | null>`coalesce(${schema.sets.imagePath}, ${schema.sets.imageUrl})`,
            createdAt: schema.listings.createdAt,
          })
          .from(schema.listings)
          .innerJoin(schema.sets, eq(schema.listings.setNum, schema.sets.setNum))
          .where(eq(schema.listings.status, "active"))
          .orderBy(desc(schema.listings.createdAt))
          .limit(5)
      : Promise.resolve([]),
    flags.forum_enabled
      ? db()
          .select({
            id: schema.topics.id,
            title: schema.topics.title,
            lastPostAt: schema.topics.lastPostAt,
            icon: schema.forumCategories.icon,
            replyCount: sql<number>`(select count(*)::int - 1 from topic_posts tp where tp.topic_id = topics.id)`,
          })
          .from(schema.topics)
          .innerJoin(schema.forumCategories, eq(schema.topics.categoryId, schema.forumCategories.id))
          .orderBy(desc(schema.topics.lastPostAt))
          .limit(5)
      : Promise.resolve([]),
    db()
      .select({
        handle: schema.users.handle,
        displayName: schema.users.displayName,
        avatarPath: schema.users.avatarPath,
        city: schema.users.city,
      })
      .from(schema.users)
      .orderBy(desc(schema.users.createdAt))
      .limit(5),
  ]);

  return (
    <aside>
      {listings.length > 0 && (
        <div className="side-block card" style={{ padding: "12px 6px 4px" }}>
          <h3 style={{ padding: "0 12px" }}>
            🏷️ Yeni ilanlar <Link href="/pazar">tümü →</Link>
          </h3>
          {listings.map((l) => (
            <Link key={l.id} href={`/pazar/${l.id}`} className="side-row">
              {l.img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={l.img} alt="" width={44} height={34} style={{ objectFit: "contain", flex: "none", background: "#fff" }} />
              ) : (
                <span style={{ fontSize: 22 }}>🧱</span>
              )}
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {l.setName}
              </span>
              <b style={{ flex: "none" }}>{Number(l.priceTry).toLocaleString("tr-TR")} ₺</b>
            </Link>
          ))}
        </div>
      )}

      {topics.length > 0 && (
        <div className="side-block card" style={{ padding: "12px 6px 4px" }}>
          <h3 style={{ padding: "0 12px" }}>
            💬 Forumda son konular <Link href="/forum">tümü →</Link>
          </h3>
          {topics.map((t) => (
            <Link key={t.id} href={`/forum/konu/${t.id}`} className="side-row">
              <span style={{ fontSize: 17, flex: "none" }}>{t.icon}</span>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.title}
              </span>
              <small style={{ color: "var(--ink3)", flex: "none" }}>
                💬 {t.replyCount} · {timeAgo(t.lastPostAt)}
              </small>
            </Link>
          ))}
        </div>
      )}

      {newUsers.length > 0 && (
        <div className="side-block card" style={{ padding: "12px 6px 4px" }}>
          <h3 style={{ padding: "0 12px" }}>
            👋 Yeni üyeler <Link href="/uyeler">tümü →</Link>
          </h3>
          {newUsers.map((u) => (
            <Link key={u.handle} href={`/u/${u.handle}`} className="side-row">
              <Avatar handle={u.handle} name={u.displayName} size={30} src={mediaUrl(u.avatarPath)} />
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {u.displayName || u.handle}
              </span>
              {u.city && <small style={{ color: "var(--ink3)", flex: "none" }}>{u.city}</small>}
            </Link>
          ))}
        </div>
      )}
    </aside>
  );
}
