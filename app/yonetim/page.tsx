import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, desc, eq, ilike, isNotNull, isNull, sql } from "drizzle-orm";
import { db, envReady, schema } from "@/db";
import { requireModerator } from "@/lib/admin/guards";
import { getFlags } from "@/lib/settings";
import {
  setUserRole,
  toggleFlag,
  toggleBan,
  resolveReport,
  deletePostAdmin,
  removeListingAdmin,
} from "@/lib/admin/actions";
import { Avatar } from "@/app/components/Avatar";
import { ConfirmSubmit } from "@/app/components/ConfirmSubmit";
import { mediaUrl } from "@/lib/media";
import { timeAgo } from "@/lib/format";

export const metadata = { title: "Yönetim" };

const ROLE_TR: Record<string, string> = {
  standard: "Üye",
  creator: "İçerik Üreticisi",
  moderator: "Moderatör",
  staff: "Yönetici",
};
const FLAG_TR: Record<string, string> = {
  market_enabled: "🏷️ Pazar",
  forum_enabled: "💬 Forum",
  signup_enabled: "🚪 Yeni kayıt",
};
const LISTING_STATUS: Record<string, { label: string; color: string }> = {
  active: { label: "Satışta", color: "var(--green)" },
  reserved: { label: "Rezerve", color: "var(--ink2)" },
  sold: { label: "Satıldı", color: "var(--red)" },
  removed: { label: "Kaldırıldı", color: "var(--ink3)" },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 26 }}>
      <h2 style={{ fontFamily: "var(--disp)", fontSize: 17, fontWeight: 800, marginBottom: 10 }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="card" style={{ padding: "14px 16px", textAlign: "center" }}>
      <b style={{ fontFamily: "var(--disp)", fontSize: 23, display: "block" }}>{value}</b>
      <div style={{ fontSize: 12.5, color: "var(--ink3)" }}>{label}</div>
      {sub && <div style={{ fontSize: 11.5, color: "var(--green)", fontWeight: 700, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

/* ================= Genel Bakış ================= */

async function GenelBakis({ isStaff }: { isStaff: boolean }) {
  const [growthRows, reports, newUsers, salesRows] = await Promise.all([
    db().execute<{
      users_total: number; users_7d: number;
      listings_active: number; listings_7d: number;
      topics_total: number; forum_posts_7d: number;
      dm_7d: number; coll_7d: number; reports_open: number;
    }>(sql`
      select
        (select count(*)::int from users) as users_total,
        (select count(*)::int from users where created_at > now() - interval '7 days') as users_7d,
        (select count(*)::int from listings where status in ('active','reserved')) as listings_active,
        (select count(*)::int from listings where created_at > now() - interval '7 days') as listings_7d,
        (select count(*)::int from topics) as topics_total,
        (select count(*)::int from topic_posts where created_at > now() - interval '7 days') as forum_posts_7d,
        (select count(*)::int from messages where created_at > now() - interval '7 days') as dm_7d,
        (select count(*)::int from collection_items where created_at > now() - interval '7 days') as coll_7d,
        (select count(*)::int from reports where resolved_at is null) as reports_open
    `),
    db()
      .select({
        id: schema.reports.id,
        targetKind: schema.reports.targetKind,
        targetId: schema.reports.targetId,
        reason: schema.reports.reason,
        createdAt: schema.reports.createdAt,
        reporterHandle: schema.users.handle,
        topicIdOfPost: sql<string | null>`(select tp.topic_id from topic_posts tp where tp.id = reports.target_id)`,
        reportedHandle: sql<string | null>`(select uu.handle from users uu where uu.id = reports.target_id)`,
      })
      .from(schema.reports)
      .innerJoin(schema.users, eq(schema.reports.reporterId, schema.users.id))
      .where(isNull(schema.reports.resolvedAt))
      .orderBy(desc(schema.reports.createdAt))
      .limit(30),
    db()
      .select({
        handle: schema.users.handle,
        displayName: schema.users.displayName,
        avatarPath: schema.users.avatarPath,
        city: schema.users.city,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .orderBy(desc(schema.users.createdAt))
      .limit(8),
    isStaff
      ? db().execute(sql`
          select
            count(*) filter (where sold_at > now() - interval '1 day')::int   as d1_n,
            coalesce(sum(price_try) filter (where sold_at > now() - interval '1 day'), 0)   as d1_v,
            count(*) filter (where sold_at > now() - interval '7 days')::int  as d7_n,
            coalesce(sum(price_try) filter (where sold_at > now() - interval '7 days'), 0)  as d7_v,
            count(*) filter (where sold_at > now() - interval '30 days')::int as d30_n,
            coalesce(sum(price_try) filter (where sold_at > now() - interval '30 days'), 0) as d30_v,
            count(*)::int as all_n,
            coalesce(sum(price_try), 0) as all_v
          from listings
          where status = 'sold' and sold_via_jestbrick
        `)
      : Promise.resolve([]),
  ]);

  const g = (Array.isArray(growthRows) ? growthRows[0] : undefined) as
    | Record<string, number>
    | undefined;
  const sales = (Array.isArray(salesRows) ? salesRows[0] : undefined) as
    | Record<string, string | number>
    | undefined;

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 10, marginBottom: 26 }}>
        <StatCard label="Üye" value={g?.users_total ?? 0} sub={g?.users_7d ? `+${g.users_7d} bu hafta` : undefined} />
        <StatCard label="Aktif ilan" value={g?.listings_active ?? 0} sub={g?.listings_7d ? `+${g.listings_7d} bu hafta` : undefined} />
        <StatCard label="Forum başlığı" value={g?.topics_total ?? 0} sub={g?.forum_posts_7d ? `${g.forum_posts_7d} mesaj/hafta` : undefined} />
        <StatCard label="DM (7 gün)" value={g?.dm_7d ?? 0} />
        <StatCard label="Koleksiyon eklemesi (7 gün)" value={g?.coll_7d ?? 0} />
        <StatCard label="Açık şikayet" value={g?.reports_open ?? 0} />
      </div>

      {isStaff && sales && (
        <Section title="💰 JestBrick üzerinden satışlar">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
            {(
              [
                ["Bugün", sales.d1_n, sales.d1_v],
                ["Son 7 gün", sales.d7_n, sales.d7_v],
                ["Son 30 gün", sales.d30_n, sales.d30_v],
                ["Toplam", sales.all_n, sales.all_v],
              ] as [string, number, number][]
            ).map(([label, n, v]) => (
              <StatCard key={label} label={label} value={`${Number(n)} satış`} sub={`${Number(v).toLocaleString("tr-TR")} ₺ hacim`} />
            ))}
          </div>
        </Section>
      )}

      <Section title={`🚩 Açık şikayetler (${reports.length})`}>
        {reports.length === 0 ? (
          <div className="notice">Kuyruk temiz 🎉</div>
        ) : (
          <div className="card" style={{ padding: 0 }}>
            {reports.map((r) => {
              const href =
                r.targetKind === "listing"
                  ? `/pazar/${r.targetId}`
                  : r.targetKind === "topic_post" && r.topicIdOfPost
                    ? `/forum/konu/${r.topicIdOfPost}`
                    : r.targetKind === "user" && r.reportedHandle
                      ? `/u/${r.reportedHandle}`
                      : null;
              return (
                <div key={r.id} style={{ display: "flex", gap: 12, padding: "12px 16px", alignItems: "center", borderBottom: "1px solid var(--line)", fontSize: 13.5 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b>
                      {r.targetKind === "listing" ? "İlan" : r.targetKind === "topic_post" ? "Forum mesajı" : r.targetKind === "user" ? "Üye" : "Paylaşım"}
                    </b>{" "}
                    — “{r.reason}”
                    <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 2 }}>
                      @{r.reporterHandle} bildirdi · {timeAgo(r.createdAt)}
                      {href && (
                        <>
                          {" · "}
                          <Link href={href} style={{ fontWeight: 700 }}>içeriğe git →</Link>
                        </>
                      )}
                    </div>
                  </div>
                  <form action={resolveReport}>
                    <input type="hidden" name="reportId" value={r.id} />
                    <button className="btn btn-o" type="submit" style={{ padding: "6px 12px", fontSize: 12.5 }}>✓ Çözüldü</button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="👋 Son katılan üyeler">
        <div className="card" style={{ padding: 0 }}>
          {newUsers.map((u2) => (
            <Link key={u2.handle} href={`/u/${u2.handle}`} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", borderBottom: "1px solid var(--line)", fontSize: 13.5, color: "inherit" }}>
              <Avatar handle={u2.handle} name={u2.displayName} size={30} src={mediaUrl(u2.avatarPath)} />
              <b style={{ flex: "none" }}>{u2.displayName || u2.handle}</b>
              <span style={{ color: "var(--ink3)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                @{u2.handle}{u2.city ? ` · ${u2.city}` : ""}
              </span>
              <small style={{ color: "var(--ink3)", flex: "none" }}>{timeAgo(u2.createdAt)}</small>
            </Link>
          ))}
        </div>
      </Section>
    </>
  );
}

/* ================= Üyeler (staff) ================= */

async function Uyeler({ q, filtre }: { q?: string; filtre?: string }) {
  const where =
    q && q.trim().length >= 2
      ? ilike(schema.users.handle, `%${q.trim()}%`)
      : filtre === "askida"
        ? isNotNull(schema.users.bannedAt)
        : filtre === "ekip"
          ? sql`${schema.users.role} in ('moderator', 'staff')`
          : undefined;

  const rows = await db()
    .select({
      id: schema.users.id,
      handle: schema.users.handle,
      displayName: schema.users.displayName,
      avatarPath: schema.users.avatarPath,
      role: schema.users.role,
      bannedAt: schema.users.bannedAt,
      createdAt: schema.users.createdAt,
      setCount: sql<number>`(select count(*)::int from collection_items ci where ci.user_id = users.id)`,
      listingCount: sql<number>`(select count(*)::int from listings l where l.seller_id = users.id)`,
    })
    .from(schema.users)
    .where(where)
    .orderBy(desc(schema.users.createdAt))
    .limit(25);

  return (
    <>
      <form method="get" action="/yonetim" style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <input type="hidden" name="sekme" value="uyeler" />
        <input
          name="u" defaultValue={q ?? ""} placeholder="Kullanıcı adı ara…"
          style={{ flex: 1, minWidth: 180, padding: "9px 13px", border: "1.5px solid var(--line)", borderRadius: 10, fontSize: 14 }}
        />
        <button className="btn btn-y" type="submit">Ara</button>
      </form>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <Link href="/yonetim?sekme=uyeler" className="chip" style={!filtre && !q ? { background: "var(--yellow)", borderColor: "var(--yellow)" } : undefined}>Son katılanlar</Link>
        <Link href="/yonetim?sekme=uyeler&filtre=ekip" className="chip" style={filtre === "ekip" ? { background: "var(--yellow)", borderColor: "var(--yellow)" } : undefined}>🛡️ Ekip</Link>
        <Link href="/yonetim?sekme=uyeler&filtre=askida" className="chip" style={filtre === "askida" ? { background: "var(--yellow)", borderColor: "var(--yellow)" } : undefined}>🚫 Askıdakiler</Link>
      </div>

      {rows.length === 0 ? (
        <div className="notice">Sonuç yok.</div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {rows.map((fu) => (
            <div key={fu.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "11px 14px", borderBottom: "1px solid var(--line)", fontSize: 13.5, flexWrap: "wrap" }}>
              <Avatar handle={fu.handle} name={fu.displayName} size={32} src={mediaUrl(fu.avatarPath)} />
              <div style={{ flex: 1, minWidth: 140, overflow: "hidden" }}>
                <Link href={`/u/${fu.handle}`} style={{ fontWeight: 700, color: fu.bannedAt ? "var(--red)" : "inherit" }}>
                  {fu.displayName || fu.handle}
                </Link>{" "}
                <span style={{ color: "var(--ink3)" }}>@{fu.handle}</span>
                <div style={{ fontSize: 11.5, color: "var(--ink3)" }}>
                  {timeAgo(fu.createdAt)} katıldı · {fu.setCount} set · {fu.listingCount} ilan
                  {fu.bannedAt ? " · 🚫 askıda" : ""}
                </div>
              </div>
              <form action={toggleBan}>
                <input type="hidden" name="userId" value={fu.id} />
                <input type="hidden" name="to" value={String(!fu.bannedAt)} />
                <button
                  className="btn btn-o" type="submit"
                  style={{ padding: "6px 12px", fontSize: 12.5, color: fu.bannedAt ? "var(--green)" : "var(--red)" }}
                >
                  {fu.bannedAt ? "Askıyı Kaldır" : "🚫 Askıya Al"}
                </button>
              </form>
              <form action={setUserRole} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input type="hidden" name="userId" value={fu.id} />
                {/* key=taze rol: React 19 form reset'inin eski değere döndürmesini engeller */}
                <select key={`${fu.id}-${fu.role}`} name="role" defaultValue={fu.role} style={{ padding: "6px 10px", border: "1.5px solid var(--line)", borderRadius: 8, fontSize: 13 }}>
                  {schema.userRole.enumValues.map((r) => (
                    <option key={r} value={r}>{ROLE_TR[r]}</option>
                  ))}
                </select>
                <button className="btn btn-o" type="submit" style={{ padding: "6px 12px", fontSize: 12.5 }}>Kaydet</button>
              </form>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ================= İçerik ================= */

async function Icerik() {
  const [listings, topics, posts] = await Promise.all([
    db()
      .select({
        id: schema.listings.id,
        priceTry: schema.listings.priceTry,
        status: schema.listings.status,
        createdAt: schema.listings.createdAt,
        setName: schema.sets.name,
        sellerHandle: schema.users.handle,
      })
      .from(schema.listings)
      .innerJoin(schema.sets, eq(schema.listings.setNum, schema.sets.setNum))
      .innerJoin(schema.users, eq(schema.listings.sellerId, schema.users.id))
      .orderBy(desc(schema.listings.createdAt))
      .limit(12),
    db()
      .select({
        id: schema.topics.id,
        title: schema.topics.title,
        pinned: schema.topics.pinned,
        locked: schema.topics.locked,
        lastPostAt: schema.topics.lastPostAt,
        authorHandle: schema.users.handle,
        replyCount: sql<number>`(select count(*)::int - 1 from topic_posts tp where tp.topic_id = topics.id)`,
      })
      .from(schema.topics)
      .innerJoin(schema.users, eq(schema.topics.authorId, schema.users.id))
      .orderBy(desc(schema.topics.lastPostAt))
      .limit(12),
    db()
      .select({
        id: schema.posts.id,
        body: schema.posts.body,
        kind: schema.posts.kind,
        createdAt: schema.posts.createdAt,
        authorHandle: schema.users.handle,
        setName: schema.sets.name,
      })
      .from(schema.posts)
      .innerJoin(schema.users, eq(schema.posts.authorId, schema.users.id))
      .leftJoin(schema.sets, eq(schema.posts.setNum, schema.sets.setNum))
      .orderBy(desc(schema.posts.createdAt))
      .limit(10),
  ]);

  return (
    <>
      <Section title="🏷️ Son ilanlar">
        <div className="card" style={{ padding: 0 }}>
          {listings.map((l) => {
            const st = LISTING_STATUS[l.status];
            return (
              <div key={l.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", borderBottom: "1px solid var(--line)", fontSize: 13.5 }}>
                <Link href={`/pazar/${l.id}`} style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 700, color: "inherit" }}>
                  {l.setName}
                </Link>
                <small style={{ color: "var(--ink3)", flex: "none" }}>
                  {Number(l.priceTry).toLocaleString("tr-TR")} ₺ · @{l.sellerHandle} · {timeAgo(l.createdAt)}
                </small>
                <span style={{ flex: "none", background: st.color, color: "#fff", fontSize: 10.5, fontWeight: 800, padding: "2px 9px", borderRadius: 99 }}>
                  {st.label}
                </span>
                {(l.status === "active" || l.status === "reserved") && (
                  <form action={removeListingAdmin}>
                    <input type="hidden" name="listingId" value={l.id} />
                    <ConfirmSubmit className="btn btn-o" style={{ padding: "4px 10px", fontSize: 11.5, color: "var(--red)" }} confirmText="Kaldır?">
                      Kaldır
                    </ConfirmSubmit>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="💬 Son forum etkinliği">
        <div className="card" style={{ padding: 0 }}>
          {topics.map((t) => (
            <Link key={t.id} href={`/forum/konu/${t.id}`} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", borderBottom: "1px solid var(--line)", fontSize: 13.5, color: "inherit" }}>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 700 }}>
                {t.pinned && "📌 "}{t.locked && "🔒 "}{t.title}
              </span>
              <small style={{ color: "var(--ink3)", flex: "none" }}>
                @{t.authorHandle} · 💬 {t.replyCount} · {timeAgo(t.lastPostAt)}
              </small>
            </Link>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "var(--ink3)", marginTop: 6 }}>
          Sabitle/kilitle/sil araçları konu sayfasının içindedir.
        </p>
      </Section>

      <Section title="📣 Son akış paylaşımları">
        <div className="card" style={{ padding: 0 }}>
          {posts.map((p) => (
            <div key={p.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", borderBottom: "1px solid var(--line)", fontSize: 13.5 }}>
              <div style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <b>@{p.authorHandle}</b>{" "}
                <span style={{ color: "var(--ink2)" }}>
                  {p.kind === "collection_add" ? `${p.setName ?? "set"} ekledi` : p.body || "(fotoğraf)"}
                </span>
              </div>
              <small style={{ color: "var(--ink3)", flex: "none" }}>{timeAgo(p.createdAt)}</small>
              <form action={deletePostAdmin}>
                <input type="hidden" name="postId" value={p.id} />
                <ConfirmSubmit className="btn btn-o" style={{ padding: "4px 10px", fontSize: 11.5, color: "var(--red)" }} confirmText="Silinsin mi?">
                  🗑
                </ConfirmSubmit>
              </form>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

/* ================= Sistem (staff) ================= */

async function Sistem() {
  const [flags, catRows, freshSets] = await Promise.all([
    getFlags(),
    db().execute<{
      sets_total: number; retired: number; minifigs: number; themes: number;
      last_sync: string | null;
    }>(sql`
      select
        (select count(*)::int from sets) as sets_total,
        (select count(*)::int from sets where retired_at is not null) as retired,
        (select count(*)::int from minifigs) as minifigs,
        (select count(distinct theme_id)::int from sets where theme_id is not null) as themes,
        (select max(last_modified)::text from sets) as last_sync
    `),
    db()
      .select({ setNum: schema.sets.setNum, name: schema.sets.name, year: schema.sets.year })
      .from(schema.sets)
      .where(isNotNull(schema.sets.lastModified))
      .orderBy(desc(schema.sets.lastModified))
      .limit(5),
  ]);
  const c = (Array.isArray(catRows) ? catRows[0] : undefined) as Record<string, number | string | null> | undefined;

  return (
    <>
      <Section title="📚 Katalog sağlığı">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 10 }}>
          <StatCard label="Set" value={Number(c?.sets_total ?? 0).toLocaleString("tr-TR")} />
          <StatCard label="Emekli işaretli" value={Number(c?.retired ?? 0).toLocaleString("tr-TR")} />
          <StatCard label="Minifigür" value={Number(c?.minifigs ?? 0).toLocaleString("tr-TR")} />
          <StatCard label="Tema" value={Number(c?.themes ?? 0)} />
        </div>
        <p style={{ fontSize: 12.5, color: "var(--ink3)", marginTop: 8 }}>
          Son katalog verisi: {c?.last_sync ? new Date(String(c.last_sync)).toLocaleString("tr-TR") : "—"} ·
          Geceleri otomatik: 06:00 Brickset (emeklilik) + 06:30 Rebrickable (yeni setler), TR saati.
        </p>
        {freshSets.length > 0 && (
          <div className="card" style={{ padding: 0, marginTop: 10 }}>
            {freshSets.map((s) => (
              <Link key={s.setNum} href={`/setler/${s.setNum}`} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "9px 14px", borderBottom: "1px solid var(--line)", fontSize: 13, color: "inherit" }}>
                <b style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</b>
                <small style={{ color: "var(--ink3)", flex: "none" }}>#{s.setNum.replace(/-1$/, "")} · {s.year}</small>
              </Link>
            ))}
          </div>
        )}
      </Section>

      <Section title="⚙️ Site anahtarları">
        <div className="card" style={{ padding: 0 }}>
          {(Object.keys(FLAG_TR) as (keyof typeof flags)[]).map((key) => (
            <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--line)", fontSize: 14 }}>
              <span>
                {FLAG_TR[key]}{" "}
                <b style={{ color: flags[key] ? "var(--green)" : "var(--red)" }}>
                  {flags[key] ? "açık" : "kapalı"}
                </b>
              </span>
              <form action={toggleFlag}>
                <input type="hidden" name="key" value={key} />
                <input type="hidden" name="to" value={String(!flags[key])} />
                <button className={flags[key] ? "btn btn-o" : "btn btn-y"} type="submit" style={{ padding: "6px 14px", fontSize: 12.5 }}>
                  {flags[key] ? "Kapat" : "Aç"}
                </button>
              </form>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12.5, color: "var(--ink3)", marginTop: 8 }}>
          Kapatılan bölüm menüden kalkar, sayfaları ana sayfaya yönlenir. Mevcut veri silinmez.
        </p>
      </Section>

      <Section title="📮 Haftalık özet e-postası">
        <div className="notice" style={{ fontSize: 13 }}>
          {process.env.RESEND_API_KEY && process.env.DIGEST_FROM
            ? "✅ Aktif — her pazartesi 06:30'da (TR) sinyali olan üyelere gönderilir."
            : "⏸ Pasif — aktifleştirmek için Vercel'e RESEND_API_KEY ve DIGEST_FROM ekle (Resend hesabı + domain doğrulaması gerekir)."}
        </div>
      </Section>
    </>
  );
}

/* ================= Ana sayfa ================= */

export default async function YonetimPage({
  searchParams,
}: {
  searchParams: Promise<{ sekme?: string; u?: string; filtre?: string }>;
}) {
  if (!envReady()) redirect("/");
  const me = await requireModerator();
  const isStaff = me.role === "staff";
  const { sekme, u, filtre } = await searchParams;

  const tabs: [string, string, boolean][] = [
    ["genel", "📊 Genel Bakış", true],
    ["uyeler", "👥 Üyeler", isStaff],
    ["icerik", "📦 İçerik", true],
    ["sistem", "🔧 Sistem", isStaff],
  ];
  const active = tabs.find(([key, , allowed]) => key === sekme && allowed)?.[0] ?? "genel";

  return (
    <main className="wrap" style={{ maxWidth: 820 }}>
      <h1 className="page" style={{ marginBottom: 6 }}>
        Yönetim{" "}
        <span style={{ fontSize: 13, color: "var(--ink3)", fontWeight: 600 }}>({ROLE_TR[me.role]})</span>
      </h1>

      <div style={{ display: "flex", gap: 8, margin: "12px 0 22px", flexWrap: "wrap" }}>
        {tabs.filter(([, , allowed]) => allowed).map(([key, label]) => (
          <Link
            key={key}
            href={key === "genel" ? "/yonetim" : `/yonetim?sekme=${key}`}
            className="chip"
            style={active === key ? { background: "var(--yellow)", borderColor: "var(--yellow)" } : undefined}
          >
            {label}
          </Link>
        ))}
      </div>

      {active === "genel" && <GenelBakis isStaff={isStaff} />}
      {active === "uyeler" && isStaff && <Uyeler q={u} filtre={filtre} />}
      {active === "icerik" && <Icerik />}
      {active === "sistem" && isStaff && <Sistem />}
    </main>
  );
}
