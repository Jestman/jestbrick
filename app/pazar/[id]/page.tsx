import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db, envReady, schema } from "@/db";
import { flagEnabled } from "@/lib/settings";
import { getUser } from "@/lib/supabase/server";
import { getListing, sellerStats } from "@/lib/market/queries";
import { contactSeller, setListingStatus, rateSeller } from "@/lib/market/actions";
import { removeListingAdmin } from "@/lib/admin/actions";
import { reportContent } from "@/lib/reports/actions";
import { currentRole, isModerator } from "@/lib/admin/guards";
import { Avatar } from "@/app/components/Avatar";
import { ConfirmSubmit } from "@/app/components/ConfirmSubmit";
import { PendingButton } from "@/app/components/PendingButton";
import { ZoomImg } from "@/app/components/Lightbox";
import { mediaUrl } from "@/lib/media";
import { timeAgo } from "@/lib/format";

const CONDITION_TR: Record<string, string> = {
  sealed: "Kapalı kutu",
  complete: "Eksiksiz",
  used: "Kullanılmış",
};
const STATUS_TR: Record<string, { label: string; color: string }> = {
  active: { label: "Satışta", color: "var(--green)" },
  reserved: { label: "Rezerve", color: "var(--ink2)" },
  sold: { label: "Satıldı", color: "var(--red)" },
  removed: { label: "Kaldırıldı", color: "var(--ink3)" },
};

/** Google: ilan metadata'sı — "lego 21319 satılık" aramaları hedefi. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!envReady() || !/^[0-9a-f-]{36}$/.test(id)) return {};
  const row = await getListing(id);
  if (!row || row.listing.status === "removed") return {};
  const l = row.listing;
  const no = l.setNum.replace(/-1$/, "");
  const title = `Satılık LEGO ${no} ${row.setName} — ${Number(l.priceTry).toLocaleString("tr-TR")} ₺`;
  const description = `${CONDITION_TR[l.condition]} LEGO ${no} ${row.setName}${l.city ? `, ${l.city}` : ""}${
    l.ships ? ", kargoyla gönderilir" : ""
  }. Koleksiyoncudan koleksiyoncuya, satıcı puanlı güvenli ilan — JestBrick Pazar.`;
  const img = row.imagePath ?? row.imageUrl;
  return {
    title,
    description,
    alternates: { canonical: `/pazar/${id}` },
    openGraph: { title, description, images: img ? [{ url: img }] : undefined },
    ...(l.status === "sold" ? { robots: { index: false } } : {}),
  };
}

export default async function IlanDetayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!envReady()) redirect("/");
  if (!(await flagEnabled("market_enabled"))) redirect("/");
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const row = await getListing(id);
  if (!row) notFound();
  const l = row.listing;

  const user = await getUser();
  const isOwner = user?.id === l.sellerId;
  const me = user ? await currentRole() : null;
  const canMod = !!me && isModerator(me.role);

  // kaldırılan ilanı sadece sahibi ve moderasyon görür
  if (l.status === "removed" && !isOwner && !canMod) notFound();

  const [stats, photos, pastSales] = await Promise.all([
    sellerStats(l.sellerId),
    db()
      .select({ storagePath: schema.listingImages.storagePath })
      .from(schema.listingImages)
      .where(eq(schema.listingImages.listingId, id))
      .orderBy(schema.listingImages.position),
    // aynı setin geçmiş satışları — fiyat pusulası
    db()
      .select({ priceTry: schema.listings.priceTry, soldAt: schema.listings.soldAt })
      .from(schema.listings)
      .where(
        and(
          eq(schema.listings.setNum, l.setNum),
          eq(schema.listings.status, "sold"),
          sql`${schema.listings.id} <> ${id}`
        )
      )
      .orderBy(sql`${schema.listings.soldAt} desc`)
      .limit(3),
  ]);
  // Satıcı fotoğrafı varsa o esas; katalog görseli yedek
  const img = photos.length > 0 ? mediaUrl(photos[0].storagePath) : (row.imagePath ?? row.imageUrl);
  const st = STATUS_TR[l.status];

  // alıcı bu ilanı puanlamış mı?
  let alreadyRated = false;
  if (user && !isOwner && l.status === "sold") {
    const r = await db()
      .select({ id: schema.sellerRatings.id })
      .from(schema.sellerRatings)
      .where(and(eq(schema.sellerRatings.listingId, id), eq(schema.sellerRatings.raterId, user.id)))
      .limit(1);
    alreadyRated = r.length > 0;
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `LEGO ${l.setNum.replace(/-1$/, "")} ${row.setName}`,
    image: img ?? undefined,
    description: l.description || `${CONDITION_TR[l.condition]} LEGO seti.`,
    offers: {
      "@type": "Offer",
      price: Number(l.priceTry),
      priceCurrency: "TRY",
      itemCondition:
        l.condition === "sealed"
          ? "https://schema.org/NewCondition"
          : "https://schema.org/UsedCondition",
      availability:
        l.status === "active" ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
      seller: { "@type": "Person", name: row.sellerName || row.sellerHandle },
    },
  };

  return (
    <main className="wrap" style={{ maxWidth: 720 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Link href="/pazar" style={{ fontSize: 13.5, fontWeight: 600 }}>← Pazara dön</Link>

      <div className="card" style={{ marginTop: 14, padding: 0, overflow: "hidden" }}>
        <div style={{ background: "var(--soft)", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 220, padding: 20, position: "relative" }}>
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt={row.setName} style={{ maxHeight: 280, maxWidth: "100%" }} />
          ) : (
            <span style={{ fontSize: 56 }}>🧱</span>
          )}
          <span style={{ position: "absolute", top: 14, left: 14, background: st.color, color: "#fff", fontSize: 12, fontWeight: 800, padding: "3px 12px", borderRadius: 99 }}>
            {st.label}
          </span>
        </div>
        {photos.length > 1 && (
          <div style={{ display: "flex", gap: 8, padding: "10px 14px", background: "var(--soft)", borderTop: "1px solid var(--line)", overflowX: "auto" }}>
            {photos.map((p, i) => {
              const u = mediaUrl(p.storagePath);
              return u ? (
                <ZoomImg
                  key={p.storagePath} src={u} alt={`Fotoğraf ${i + 1}`}
                  style={{ height: 72, borderRadius: 8, border: "1px solid var(--line)" }}
                />
              ) : null;
            })}
          </div>
        )}

        <div style={{ padding: "20px 24px" }}>
          <h1 style={{ fontFamily: "var(--disp)", fontSize: 22, fontWeight: 800, letterSpacing: "-0.3px" }}>
            {row.setName}
          </h1>
          <p style={{ color: "var(--ink2)", marginTop: 4, fontSize: 13.5 }}>
            <Link href={`/setler/${l.setNum}`} style={{ fontWeight: 600 }}>
              #{l.setNum.replace(/-1$/, "")} set sayfası →
            </Link>{" "}
            · {row.numParts.toLocaleString("tr-TR")} parça
          </p>

          <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 14, flexWrap: "wrap" }}>
            <b style={{ fontFamily: "var(--disp)", fontSize: 30 }}>
              {Number(l.priceTry).toLocaleString("tr-TR")} ₺
            </b>
            {row.msrpTry && (
              <span style={{ fontSize: 13, color: "var(--ink3)" }}>
                liste: {Number(row.msrpTry).toLocaleString("tr-TR")} ₺
              </span>
            )}
          </div>
          {pastSales.length > 0 && (
            <p style={{ fontSize: 12.5, color: "var(--ink3)", marginTop: 6 }}>
              📈 Bu setin JestBrick'teki son satışları:{" "}
              {pastSales
                .map(
                  (p) =>
                    `${Number(p.priceTry).toLocaleString("tr-TR")} ₺${
                      p.soldAt ? ` (${p.soldAt.toLocaleDateString("tr-TR", { day: "numeric", month: "short" })})` : ""
                    }`
                )
                .join(" · ")}
            </p>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", fontSize: 13 }}>
            <span className="chip">{CONDITION_TR[l.condition]}</span>
            {l.city && <span className="chip">📍 {l.city}</span>}
            <span className="chip">{l.ships ? "📦 Kargolar" : "🤝 Elden teslim"}</span>
            <span className="chip">🕐 {timeAgo(l.createdAt)}</span>
          </div>

          {l.description && (
            <p style={{ marginTop: 16, fontSize: 14.5, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
              {l.description}
            </p>
          )}

          {/* satıcı kartı */}
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 20, background: "var(--soft)", borderRadius: 12, padding: "12px 16px" }}>
            <Link href={`/u/${row.sellerHandle}`}>
              <Avatar handle={row.sellerHandle} name={row.sellerName} size={42} src={mediaUrl(row.sellerAvatar)} />
            </Link>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Link href={`/u/${row.sellerHandle}`} style={{ fontWeight: 700, fontSize: 14.5, color: "inherit" }}>
                {row.sellerName || row.sellerHandle}
              </Link>
              <div style={{ fontSize: 12.5, color: "var(--ink3)" }}>
                @{row.sellerHandle}
                {stats.avgScore != null
                  ? ` · ⭐ ${stats.avgScore.toFixed(1)} (${stats.ratingCount})`
                  : " · henüz puanı yok"}
                {stats.soldCount > 0 ? ` · ${stats.soldCount} satış` : ""}
              </div>
            </div>
            {user && !isOwner && (l.status === "active" || l.status === "reserved") && (
              <form action={contactSeller}>
                <input type="hidden" name="listingId" value={l.id} />
                <PendingButton pendingText="Açılıyor…">💬 Satıcıya Mesaj</PendingButton>
              </form>
            )}
            {!user && (
              <Link href={`/giris?sonra=/pazar/${l.id}`} className="btn btn-y">
                💬 Satıcıya Mesaj
              </Link>
            )}
          </div>

          {/* sahibi: durum yönetimi */}
          {isOwner && (
            <div style={{ marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
              <b style={{ fontSize: 13.5 }}>İlan yönetimi</b>
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                {l.status !== "active" && <StatusBtn id={l.id} to="active" label="Tekrar Satışta" />}
                {l.status === "active" && <StatusBtn id={l.id} to="reserved" label="Rezerve İşaretle" />}
                {l.status !== "removed" && <StatusBtn id={l.id} to="removed" label="Kaldır" />}
              </div>
              {l.status !== "sold" && (
                <form
                  action={setListingStatus}
                  style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 10, background: "var(--soft)", borderRadius: 10, padding: "10px 14px" }}
                >
                  <input type="hidden" name="listingId" value={l.id} />
                  <input type="hidden" name="status" value="sold" />
                  <label style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 13, cursor: "pointer" }}>
                    <input type="checkbox" name="via" defaultChecked />
                    Alıcıyı JestBrick'te buldum
                  </label>
                  <button className="btn btn-y" type="submit" style={{ padding: "7px 14px", fontSize: 13, marginLeft: "auto" }}>
                    ✓ Satıldı Olarak İşaretle
                  </button>
                </form>
              )}
              {l.status === "sold" && (
                <p style={{ fontSize: 12.5, color: "var(--ink3)", marginTop: 8 }}>
                  {l.soldViaJestbrick ? "🧱 JestBrick üzerinden satıldı olarak işaretlendi." : "Satıldı (platform dışı)."}
                </p>
              )}
            </div>
          )}

          {/* alıcı: satış sonrası puanlama */}
          {user && !isOwner && l.status === "sold" && !alreadyRated && (
            <form
              action={rateSeller}
              style={{ marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 14, display: "grid", gap: 10 }}
            >
              <input type="hidden" name="listingId" value={l.id} />
              <b style={{ fontSize: 13.5 }}>Bu satıcıdan aldıysan puanla</b>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <select name="score" defaultValue="5" style={{ padding: "8px 12px", border: "1.5px solid var(--line)", borderRadius: 10, fontSize: 14 }}>
                  <option value="5">⭐⭐⭐⭐⭐ Harika</option>
                  <option value="4">⭐⭐⭐⭐ İyi</option>
                  <option value="3">⭐⭐⭐ İdare eder</option>
                  <option value="2">⭐⭐ Sorunlu</option>
                  <option value="1">⭐ Kötü</option>
                </select>
                <input
                  name="comment" placeholder="Kısa yorum (isteğe bağlı)" maxLength={500}
                  style={{ flex: 1, minWidth: 200, padding: "8px 12px", border: "1.5px solid var(--line)", borderRadius: 10, fontSize: 14 }}
                />
                <button className="btn btn-o" type="submit">Gönder</button>
              </div>
            </form>
          )}
          {alreadyRated && (
            <p style={{ marginTop: 14, fontSize: 13, color: "var(--green)", fontWeight: 700 }}>
              ✓ Bu satıcıyı puanladın, teşekkürler!
            </p>
          )}

          {/* şikayet + moderasyon */}
          <div style={{ display: "flex", gap: 12, marginTop: 16, justifyContent: "flex-end", alignItems: "center" }}>
            {user && !isOwner && (
              <form action={reportContent}>
                <input type="hidden" name="targetKind" value="listing" />
                <input type="hidden" name="targetId" value={l.id} />
                <input type="hidden" name="reason" value="İlan şikayeti" />
                <input type="hidden" name="back" value={`/pazar/${l.id}`} />
                <button type="submit" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12.5, color: "var(--ink3)" }}>
                  🚩 İlanı şikayet et
                </button>
              </form>
            )}
            {canMod && !isOwner && l.status !== "removed" && (
              <form action={removeListingAdmin}>
                <input type="hidden" name="listingId" value={l.id} />
                <ConfirmSubmit className="btn btn-o" style={{ padding: "6px 12px", fontSize: 12.5, color: "var(--red)" }} confirmText="Kaldırılsın mı?">
                  🛡️ İlanı Kaldır
                </ConfirmSubmit>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function StatusBtn({ id, to, label, primary }: { id: string; to: string; label: string; primary?: boolean }) {
  return (
    <form action={setListingStatus}>
      <input type="hidden" name="listingId" value={id} />
      <input type="hidden" name="status" value={to} />
      {to === "removed" ? (
        <ConfirmSubmit className="btn btn-o" style={{ padding: "7px 14px", fontSize: 13 }} confirmText="İlan kaldırılsın mı?">
          {label}
        </ConfirmSubmit>
      ) : (
        <button className={primary ? "btn btn-y" : "btn btn-o"} type="submit" style={{ padding: "7px 14px", fontSize: 13 }}>
          {label}
        </button>
      )}
    </form>
  );
}
