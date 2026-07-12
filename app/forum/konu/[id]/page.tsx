import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, envReady, schema } from "@/db";
import { flagEnabled } from "@/lib/settings";
import { getUser } from "@/lib/supabase/server";
import { replyTopic } from "@/lib/forum/actions";
import { modTopic, deleteTopicPost } from "@/lib/admin/actions";
import { reportContent } from "@/lib/reports/actions";
import { currentRole, isModerator } from "@/lib/admin/guards";
import { Avatar } from "@/app/components/Avatar";
import { mediaUrl } from "@/lib/media";
import { timeAgo } from "@/lib/format";

export default async function KonuPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!envReady()) redirect("/");
  if (!(await flagEnabled("forum_enabled"))) redirect("/");
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const [topicRows, posts, user] = await Promise.all([
    db()
      .select({
        topic: schema.topics,
        categoryName: schema.forumCategories.name,
        categoryIcon: schema.forumCategories.icon,
        categorySlug: schema.forumCategories.slug,
      })
      .from(schema.topics)
      .innerJoin(schema.forumCategories, eq(schema.topics.categoryId, schema.forumCategories.id))
      .where(eq(schema.topics.id, id))
      .limit(1),
    db()
      .select({
        id: schema.topicPosts.id,
        body: schema.topicPosts.body,
        createdAt: schema.topicPosts.createdAt,
        authorId: schema.topicPosts.authorId,
        authorHandle: schema.users.handle,
        authorName: schema.users.displayName,
        authorAvatar: schema.users.avatarPath,
      })
      .from(schema.topicPosts)
      .innerJoin(schema.users, eq(schema.topicPosts.authorId, schema.users.id))
      .where(eq(schema.topicPosts.topicId, id))
      .orderBy(asc(schema.topicPosts.createdAt))
      .limit(200),
    getUser(),
  ]);

  const row = topicRows[0];
  if (!row) notFound();
  const t = row.topic;

  const me = user ? await currentRole() : null;
  const canMod = !!me && isModerator(me.role);

  return (
    <main className="wrap" style={{ maxWidth: 720 }}>
      <Link href={`/forum?k=${row.categorySlug}`} style={{ fontSize: 13.5, fontWeight: 600 }}>
        ← {row.categoryIcon} {row.categoryName}
      </Link>
      <h1 className="page" style={{ marginTop: 10, marginBottom: 14 }}>
        {t.pinned && "📌 "}
        {t.locked && "🔒 "}
        {t.title}
      </h1>

      {canMod && (
        <div className="notice" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
          <b style={{ fontSize: 12.5 }}>🛡️ Moderasyon:</b>
          <ModBtn topicId={t.id} op={t.pinned ? "unpin" : "pin"} label={t.pinned ? "Sabitliği kaldır" : "📌 Sabitle"} />
          <ModBtn topicId={t.id} op={t.locked ? "unlock" : "lock"} label={t.locked ? "Kilidi aç" : "🔒 Kilitle"} />
          <ModBtn topicId={t.id} op="delete" label="🗑 Başlığı Sil" />
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {posts.map((p, i) => (
          <div key={p.id} className="card" style={{ padding: "14px 18px" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
              <Link href={`/u/${p.authorHandle}`}>
                <Avatar handle={p.authorHandle} name={p.authorName} size={32} src={mediaUrl(p.authorAvatar)} />
              </Link>
              <div>
                <Link href={`/u/${p.authorHandle}`} style={{ fontWeight: 700, fontSize: 13.5, color: "inherit" }}>
                  {p.authorName || p.authorHandle}
                </Link>
                <span style={{ fontSize: 12, color: "var(--ink3)", marginLeft: 8 }}>
                  {i === 0 ? "konuyu açtı" : "yanıtladı"} · {timeAgo(p.createdAt)}
                </span>
              </div>
            </div>
            <p style={{ fontSize: 14.5, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{p.body}</p>
            <div style={{ display: "flex", gap: 10, marginTop: 8, justifyContent: "flex-end" }}>
              {user && user.id !== p.authorId && (
                <form action={reportContent}>
                  <input type="hidden" name="targetKind" value="topic_post" />
                  <input type="hidden" name="targetId" value={p.id} />
                  <input type="hidden" name="reason" value="Forum mesajı şikayeti" />
                  <input type="hidden" name="back" value={`/forum/konu/${t.id}`} />
                  <button type="submit" title="Şikayet et" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--ink3)" }}>
                    🚩 Şikayet
                  </button>
                </form>
              )}
              {canMod && i > 0 && (
                <form action={deleteTopicPost}>
                  <input type="hidden" name="postId" value={p.id} />
                  <input type="hidden" name="topicId" value={t.id} />
                  <button type="submit" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--red)", fontWeight: 700 }}>
                    🗑 Sil
                  </button>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>

      {user && !t.locked ? (
        <form action={replyTopic} style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
          <input type="hidden" name="topicId" value={t.id} />
          <textarea
            name="body" required minLength={2} rows={4} maxLength={10000}
            placeholder="Yanıt yaz…"
            style={{
              width: "100%", padding: "12px 15px", border: "1.5px solid var(--line)",
              borderRadius: 12, fontSize: 14, fontFamily: "inherit", resize: "vertical", background: "#fff",
            }}
          />
          <button className="btn btn-y" type="submit" style={{ alignSelf: "flex-start" }}>
            Yanıtla
          </button>
        </form>
      ) : t.locked ? (
        <div className="notice" style={{ marginTop: 18 }}>🔒 Bu başlık yanıtlara kapatıldı.</div>
      ) : (
        <div className="notice" style={{ marginTop: 18 }}>
          Yanıt yazmak için <Link href={`/giris?sonra=/forum/konu/${t.id}`} style={{ fontWeight: 700 }}>giriş yap</Link>.
        </div>
      )}
    </main>
  );
}

function ModBtn({ topicId, op, label }: { topicId: string; op: string; label: string }) {
  return (
    <form action={modTopic} style={{ display: "inline" }}>
      <input type="hidden" name="topicId" value={topicId} />
      <input type="hidden" name="op" value={op} />
      <button className="btn btn-o" type="submit" style={{ padding: "5px 11px", fontSize: 12 }}>
        {label}
      </button>
    </form>
  );
}
