import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, eq, inArray } from "drizzle-orm";
import { db, envReady, schema } from "@/db";
import { flagEnabled } from "@/lib/settings";
import { getUser } from "@/lib/supabase/server";
import { replyTopic } from "@/lib/forum/actions";
import { modTopic, deleteTopicPost } from "@/lib/admin/actions";
import { reportContent } from "@/lib/reports/actions";
import { currentRole, isModerator } from "@/lib/admin/guards";
import { Avatar, RoleBadge } from "@/app/components/Avatar";
import { RichBody } from "@/app/components/RichBody";
import { mediaUrl } from "@/lib/media";
import { timeAgo } from "@/lib/format";

/** Google için konu metadata'sı. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!envReady() || !/^[0-9a-f-]{36}$/.test(id)) return {};
  const [row] = await db()
    .select({
      title: schema.topics.title,
      excerpt: schema.topicPosts.body,
    })
    .from(schema.topics)
    .innerJoin(schema.topicPosts, eq(schema.topicPosts.topicId, schema.topics.id))
    .where(eq(schema.topics.id, id))
    .orderBy(asc(schema.topicPosts.createdAt))
    .limit(1);
  if (!row) return {};
  return {
    title: `${row.title} — Forum`,
    description: row.excerpt.slice(0, 155),
    alternates: { canonical: `/forum/konu/${id}` },
  };
}

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
        authorRole: schema.users.role,
        authorSince: schema.users.createdAt,
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

  // fotoğraflar
  const postIds = posts.map((p) => p.id);
  const media = postIds.length
    ? await db()
        .select({
          topicPostId: schema.topicPostMedia.topicPostId,
          storagePath: schema.topicPostMedia.storagePath,
        })
        .from(schema.topicPostMedia)
        .where(inArray(schema.topicPostMedia.topicPostId, postIds))
        .orderBy(asc(schema.topicPostMedia.position))
    : [];
  const mediaByPost = new Map<string, string[]>();
  for (const m of media) {
    const arr = mediaByPost.get(m.topicPostId) ?? [];
    const url = mediaUrl(m.storagePath);
    if (url) arr.push(url);
    mediaByPost.set(m.topicPostId, arr);
  }

  const me = user ? await currentRole() : null;
  const canMod = !!me && isModerator(me.role);

  // Google: tartışma yapısal verisi
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: t.title,
    text: posts[0]?.body.slice(0, 500),
    author: { "@type": "Person", name: posts[0]?.authorName || posts[0]?.authorHandle },
    datePublished: t.createdAt.toISOString(),
    interactionStatistic: {
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/CommentAction",
      userInteractionCount: Math.max(0, posts.length - 1),
    },
  };

  return (
    <main className="wrap" style={{ maxWidth: 820 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div style={{ fontSize: 13, color: "var(--ink3)", display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Link href="/forum" style={{ fontWeight: 600 }}>Forum</Link>
        <span>›</span>
        <Link href={`/forum?k=${row.categorySlug}`} style={{ fontWeight: 600 }}>
          {row.categoryIcon} {row.categoryName}
        </Link>
      </div>
      <h1 className="page" style={{ marginTop: 8, marginBottom: 14 }}>
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

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {posts.map((p, i) => {
          const photos = mediaByPost.get(p.id) ?? [];
          return (
            <article key={p.id} id={`m${i + 1}`} className="card forum-post">
              <div className="fp-author">
                <Link href={`/u/${p.authorHandle}`} style={{ lineHeight: 0 }}>
                  <Avatar handle={p.authorHandle} name={p.authorName} size={52} src={mediaUrl(p.authorAvatar)} />
                </Link>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <Link href={`/u/${p.authorHandle}`} style={{ color: "inherit" }}>
                    <b>{p.authorName || p.authorHandle}</b>
                  </Link>
                  <RoleBadge role={p.authorRole} />
                  <small>@{p.authorHandle}</small>
                  <small>
                    üye: {p.authorSince.toLocaleDateString("tr-TR", { month: "short", year: "numeric" })}
                  </small>
                </div>
              </div>
              <div className="fp-main">
                <div className="fp-meta">
                  #{i + 1} · {i === 0 ? "konuyu açtı" : "yanıtladı"} · {timeAgo(p.createdAt)}
                </div>
                <RichBody text={p.body} style={{ fontSize: 14.5, lineHeight: 1.65 }} />
                {photos.length > 0 && (
                  <div className="fp-photos">
                    {photos.map((url, j) => (
                      <a key={j} href={url} target="_blank" rel="noopener">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Fotoğraf ${j + 1}`} loading="lazy" />
                      </a>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, marginTop: "auto", paddingTop: 10, justifyContent: "flex-end" }}>
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
            </article>
          );
        })}
      </div>

      {user && !t.locked ? (
        <form action={replyTopic} className="card" style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10, padding: "16px 18px" }}>
          <b style={{ fontFamily: "var(--disp)", fontSize: 14.5 }}>Yanıt yaz</b>
          <input type="hidden" name="topicId" value={t.id} />
          <textarea
            name="body" required minLength={2} rows={5} maxLength={10000}
            placeholder={"Düşünceni yaz…\n\nİpucu: #10281 gibi set numaraları otomatik bağlanır, linkler tıklanabilir olur."}
            style={{
              width: "100%", padding: "12px 15px", border: "1.5px solid var(--line)",
              borderRadius: 12, fontSize: 14, fontFamily: "inherit", resize: "vertical", background: "var(--soft)",
            }}
          />
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink2)", cursor: "pointer", flex: 1, minWidth: 200 }}>
              📷 Fotoğraf ekle (en fazla 4)
              <input type="file" name="photos" accept="image/*" multiple style={{ display: "block", fontSize: 12, marginTop: 4, width: "100%" }} />
            </label>
            <button className="btn btn-y" type="submit">Yanıtla</button>
          </div>
        </form>
      ) : t.locked ? (
        <div className="notice" style={{ marginTop: 18 }}>🔒 Bu başlık yanıtlara kapatıldı.</div>
      ) : (
        <div className="notice" style={{ marginTop: 18 }}>
          Yanıt yazmak için <Link href={`/giris?sonra=/forum/konu/${t.id}`} style={{ fontWeight: 700 }}>giriş yap</Link> ya da{" "}
          <Link href={`/kayit?sonra=/forum/konu/${t.id}`} style={{ fontWeight: 700 }}>ücretsiz katıl</Link>.
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
