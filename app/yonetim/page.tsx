import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, desc, eq, ilike, isNull, sql } from "drizzle-orm";
import { db, envReady, schema } from "@/db";
import { requireModerator } from "@/lib/admin/guards";
import { getFlags } from "@/lib/settings";
import { setUserRole, toggleFlag, resolveReport } from "@/lib/admin/actions";
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

export default async function YonetimPage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string }>;
}) {
  if (!envReady()) redirect("/");
  const me = await requireModerator();
  const isStaff = me.role === "staff";
  const { u } = await searchParams;

  // JestBrick üzerinden satış istatistikleri (satıcı beyanı: sold + sold_via_jestbrick)
  const salesPromise = db().execute(sql`
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
  `);

  const [stats, reports, flags, foundUsers, salesRows] = await Promise.all([
    db()
      .select({
        users: sql<number>`(select count(*)::int from users)`,
        listings: sql<number>`(select count(*)::int from listings where status in ('active','reserved'))`,
        topics: sql<number>`(select count(*)::int from topics)`,
        openReports: sql<number>`(select count(*)::int from reports where resolved_at is null)`,
      })
      .from(sql`(select 1) as one`),
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
    getFlags(),
    isStaff && u && u.trim().length >= 2
      ? db()
          .select({
            id: schema.users.id,
            handle: schema.users.handle,
            displayName: schema.users.displayName,
            role: schema.users.role,
          })
          .from(schema.users)
          .where(ilike(schema.users.handle, `%${u.trim()}%`))
          .orderBy(asc(schema.users.handle))
          .limit(10)
      : Promise.resolve([]),
    salesPromise,
  ]);
  const s = stats[0];
  const sales = (Array.isArray(salesRows) ? salesRows[0] : (salesRows as { rows?: unknown[] }).rows?.[0]) as
    | Record<string, string | number>
    | undefined;
  const salesCells: [string, number, number][] = sales
    ? [
        ["Bugün", Number(sales.d1_n), Number(sales.d1_v)],
        ["Son 7 gün", Number(sales.d7_n), Number(sales.d7_v)],
        ["Son 30 gün", Number(sales.d30_n), Number(sales.d30_v)],
        ["Toplam", Number(sales.all_n), Number(sales.all_v)],
      ]
    : [];

  return (
    <main className="wrap" style={{ maxWidth: 760 }}>
      <h1 className="page">
        Yönetim{" "}
        <span style={{ fontSize: 13, color: "var(--ink3)", fontWeight: 600 }}>
          ({ROLE_TR[me.role]})
        </span>
      </h1>

      {/* özet */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 26 }}>
        {[
          ["Üye", s.users],
          ["Aktif ilan", s.listings],
          ["Forum başlığı", s.topics],
          ["Açık şikayet", s.openReports],
        ].map(([label, n]) => (
          <div key={label} className="card" style={{ padding: "14px 18px", textAlign: "center" }}>
            <b style={{ fontFamily: "var(--disp)", fontSize: 24 }}>{n}</b>
            <div style={{ fontSize: 12.5, color: "var(--ink3)" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* şikayet kuyruğu */}
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
                <div
                  key={r.id}
                  style={{
                    display: "flex", gap: 12, padding: "12px 16px", alignItems: "center",
                    borderBottom: "1px solid var(--line)", fontSize: 13.5,
                  }}
                >
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
                    <button className="btn btn-o" type="submit" style={{ padding: "6px 12px", fontSize: 12.5 }}>
                      ✓ Çözüldü
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* JestBrick üzerinden satışlar */}
      {salesCells.length > 0 && (
        <Section title="💰 JestBrick üzerinden satışlar">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
            {salesCells.map(([label, n, v]) => (
              <div key={label} className="card" style={{ padding: "14px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 12, color: "var(--ink3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  {label}
                </div>
                <b style={{ fontFamily: "var(--disp)", fontSize: 22, display: "block", marginTop: 4 }}>
                  {n} satış
                </b>
                <div style={{ fontSize: 13, color: "var(--ink2)" }}>{v.toLocaleString("tr-TR")} ₺ hacim</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12.5, color: "var(--ink3)", marginTop: 8 }}>
            Satıcının “Alıcıyı JestBrick'te buldum” beyanına dayanır; platform dışı satışlar sayılmaz.
          </p>
        </Section>
      )}

      {/* staff: site anahtarları */}
      {isStaff && (
        <Section title="⚙️ Site anahtarları">
          <div className="card" style={{ padding: 0 }}>
            {(Object.keys(FLAG_TR) as (keyof typeof flags)[]).map((key) => (
              <div
                key={key}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "12px 16px", borderBottom: "1px solid var(--line)", fontSize: 14,
                }}
              >
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
      )}

      {/* staff: rol atama */}
      {isStaff && (
        <Section title="👥 Üye rolleri">
          <form method="get" style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              name="u" defaultValue={u ?? ""} placeholder="Kullanıcı adı ara…"
              style={{ flex: 1, padding: "9px 13px", border: "1.5px solid var(--line)", borderRadius: 10, fontSize: 14 }}
            />
            <button className="btn btn-y" type="submit">Ara</button>
          </form>
          {foundUsers.length > 0 && (
            <div className="card" style={{ padding: 0 }}>
              {foundUsers.map((fu) => (
                <div
                  key={fu.id}
                  style={{
                    display: "flex", gap: 10, alignItems: "center", padding: "11px 16px",
                    borderBottom: "1px solid var(--line)", fontSize: 13.5,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link href={`/u/${fu.handle}`} style={{ fontWeight: 700, color: "inherit" }}>
                      {fu.displayName || fu.handle}
                    </Link>{" "}
                    <span style={{ color: "var(--ink3)" }}>@{fu.handle}</span>
                  </div>
                  <form action={setUserRole} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input type="hidden" name="userId" value={fu.id} />
                    <select
                      name="role" defaultValue={fu.role}
                      style={{ padding: "6px 10px", border: "1.5px solid var(--line)", borderRadius: 8, fontSize: 13 }}
                    >
                      {schema.userRole.enumValues.map((r) => (
                        <option key={r} value={r}>{ROLE_TR[r]}</option>
                      ))}
                    </select>
                    <button className="btn btn-o" type="submit" style={{ padding: "6px 12px", fontSize: 12.5 }}>
                      Kaydet
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
          {u && u.trim().length >= 2 && foundUsers.length === 0 && (
            <div className="notice">“{u}” için sonuç yok.</div>
          )}
        </Section>
      )}

      {!isStaff && (
        <p style={{ fontSize: 12.5, color: "var(--ink3)" }}>
          Moderatör yetkisi: şikayet kuyruğu + forum/pazar moderasyonu. Site anahtarları ve rol atama yöneticiye özeldir.
        </p>
      )}
    </main>
  );
}
