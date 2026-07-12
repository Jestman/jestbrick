import Link from "next/link";
import { redirect } from "next/navigation";
import { envReady } from "@/db";
import { getUser } from "@/lib/supabase/server";
import { activeListings } from "@/lib/market/queries";
import { timeAgo } from "@/lib/format";

export const metadata = { title: "Pazar — Satılık Setler" };

const CONDITION_TR: Record<string, string> = {
  sealed: "Kapalı kutu",
  complete: "Eksiksiz",
  used: "Kullanılmış",
};

export default async function PazarPage() {
  if (!envReady()) redirect("/");
  const [user, listings] = await Promise.all([getUser(), activeListings()]);

  return (
    <main className="wrap">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <h1 className="page" style={{ marginBottom: 0 }}>Pazar</h1>
        {user && (
          <Link href="/pazar/yeni" className="btn btn-y">
            + İlan Ver
          </Link>
        )}
      </div>
      <p style={{ color: "var(--ink2)", fontSize: 14, margin: "8px 0 20px" }}>
        Koleksiyoncudan koleksiyoncuya. İlan verince seti isteyenlere otomatik haber gider 🔔
      </p>

      {listings.length === 0 ? (
        <div className="notice">
          Henüz aktif ilan yok. {user ? "İlk ilanı sen ver!" : "Katıl ve ilk ilanı sen ver!"}
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
