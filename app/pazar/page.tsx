import Link from "next/link";
import { redirect } from "next/navigation";
import { envReady } from "@/db";
import { flagEnabled } from "@/lib/settings";
import { getUser } from "@/lib/supabase/server";
import { activeListings } from "@/lib/market/queries";
import { timeAgo } from "@/lib/format";

export const metadata = { title: "Pazar — Satılık Setler" };

const CONDITION_TR: Record<string, string> = {
  sealed: "Kapalı kutu",
  complete: "Eksiksiz",
  used: "Kullanılmış",
};

export default async function PazarPage({
  searchParams,
}: {
  searchParams: Promise<{ durum?: string; sehir?: string; min?: string; max?: string; sirala?: string }>;
}) {
  if (!envReady()) redirect("/");
  if (!(await flagEnabled("market_enabled"))) redirect("/");
  const { durum, sehir, min, max, sirala } = await searchParams;
  const [user, listings] = await Promise.all([
    getUser(),
    activeListings({
      condition: durum,
      city: sehir?.trim() || undefined,
      minPrice: min ? Number(min) : undefined,
      maxPrice: max ? Number(max) : undefined,
      sort: sirala,
    }),
  ]);
  const hasFilter = !!(durum || sehir || min || max || sirala);

  const selStyle: React.CSSProperties = {
    padding: "8px 10px", border: "1.5px solid var(--line)", borderRadius: 9,
    fontSize: 13, background: "#fff",
  };

  return (
    <main className="wrap">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <h1 className="page" style={{ marginBottom: 0 }}>Pazar</h1>
        {user && (
          <span style={{ display: "inline-flex", gap: 8 }}>
            <Link href="/pazar/ilanlarim" className="btn btn-o">İlanlarım</Link>
            <Link href="/pazar/yeni" className="btn btn-y">+ İlan Ver</Link>
          </span>
        )}
      </div>
      <p style={{ color: "var(--ink2)", fontSize: 14, margin: "8px 0 14px" }}>
        Koleksiyoncudan koleksiyoncuya. İlan verince seti isteyenlere otomatik haber gider 🔔
      </p>

      <form method="get" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 20 }}>
        <select name="durum" defaultValue={durum ?? ""} style={selStyle}>
          <option value="">Durum: tümü</option>
          <option value="sealed">Kapalı kutu</option>
          <option value="complete">Eksiksiz</option>
          <option value="used">Kullanılmış</option>
        </select>
        <input name="sehir" defaultValue={sehir ?? ""} placeholder="Şehir" style={{ ...selStyle, width: 110 }} />
        <input name="min" type="number" min={0} defaultValue={min ?? ""} placeholder="Min ₺" style={{ ...selStyle, width: 84 }} />
        <input name="max" type="number" min={0} defaultValue={max ?? ""} placeholder="Max ₺" style={{ ...selStyle, width: 84 }} />
        <select name="sirala" defaultValue={sirala ?? ""} style={selStyle}>
          <option value="">En yeni</option>
          <option value="ucuz">Fiyat: artan</option>
          <option value="pahali">Fiyat: azalan</option>
        </select>
        <button className="btn btn-o" type="submit" style={{ padding: "7px 14px", fontSize: 13 }}>
          Filtrele
        </button>
        {hasFilter && (
          <Link href="/pazar" style={{ fontSize: 12.5, fontWeight: 600 }}>✕ temizle</Link>
        )}
      </form>

      {listings.length === 0 ? (
        <div className="notice">
          {hasFilter
            ? "Bu filtrelere uyan ilan yok — filtreleri gevşetmeyi dene."
            : `Henüz aktif ilan yok. ${user ? "İlk ilanı sen ver!" : "Katıl ve ilk ilanı sen ver!"}`}
        </div>
      ) : (
        <div className="setgrid">
          {listings.map((l) => {
            const img = l.imagePath ?? l.imageUrl;
            return (
              <Link key={l.id} href={`/pazar/${l.id}`} className="setcard">
                <div className="img" style={{ position: "relative" }}>
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt={l.setName} loading="lazy" />
                  ) : (
                    <span style={{ fontSize: 40 }}>🧱</span>
                  )}
                  {l.status === "reserved" && (
                    <span
                      style={{
                        position: "absolute", top: 8, left: 8, background: "var(--ink)",
                        color: "#fff", fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 99,
                      }}
                    >
                      REZERVE
                    </span>
                  )}
                </div>
                <div className="meta">
                  <b>{l.setName}</b>
                  <small>
                    <b style={{ color: "var(--ink)", fontSize: 14 }}>
                      {Number(l.priceTry).toLocaleString("tr-TR")} ₺
                    </b>
                    {" · "}{CONDITION_TR[l.condition]}
                  </small>
                  <small>
                    @{l.sellerHandle}
                    {l.city ? ` · ${l.city}` : ""}
                    {l.ships ? " · 📦 kargolar" : " · elden"}
                    {" · "}{timeAgo(l.createdAt)}
                  </small>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
