import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { db, envReady, schema } from "@/db";
import { flagEnabled } from "@/lib/settings";
import { getUser } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/format";

export const metadata = { title: "İlanlarım" };

const STATUS_TR: Record<string, { label: string; color: string }> = {
  active: { label: "Satışta", color: "var(--green)" },
  reserved: { label: "Rezerve", color: "var(--ink2)" },
  sold: { label: "Satıldı", color: "var(--red)" },
  removed: { label: "Kaldırıldı", color: "var(--ink3)" },
};

export default async function IlanlarimPage() {
  if (!envReady()) redirect("/");
  if (!(await flagEnabled("market_enabled"))) redirect("/");
  const user = await getUser();
  if (!user) redirect("/giris?sonra=/pazar/ilanlarim");

  const rows = await db()
    .select({
      id: schema.listings.id,
      priceTry: schema.listings.priceTry,
      status: schema.listings.status,
      soldViaJestbrick: schema.listings.soldViaJestbrick,
      createdAt: schema.listings.createdAt,
      soldAt: schema.listings.soldAt,
      setName: schema.sets.name,
      img: sql<string | null>`coalesce(${schema.sets.imagePath}, ${schema.sets.imageUrl})`,
    })
    .from(schema.listings)
    .innerJoin(schema.sets, eq(schema.listings.setNum, schema.sets.setNum))
    .where(eq(schema.listings.sellerId, user.id))
    .orderBy(desc(schema.listings.createdAt))
    .limit(100);

  const soldCount = rows.filter((r) => r.status === "sold").length;
  const soldSum = rows
    .filter((r) => r.status === "sold")
    .reduce((a, r) => a + Number(r.priceTry), 0);

  return (
    <main className="wrap" style={{ maxWidth: 820 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <h1 className="page" style={{ marginBottom: 0 }}>İlanlarım</h1>
        <Link href="/pazar/yeni" className="btn btn-y">+ İlan Ver</Link>
      </div>

      {soldCount > 0 && (
        <p style={{ fontSize: 13.5, color: "var(--ink2)", marginBottom: 14 }}>
          Bugüne dek <b>{soldCount}</b> satış · toplam <b>{soldSum.toLocaleString("tr-TR")} ₺</b> 🎉
        </p>
      )}

      {rows.length === 0 ? (
        <div className="notice">
          Henüz ilan vermedin. Koleksiyonundaki bir setin sayfasından <b>🏷️ Satışa Çıkar</b>’a bas
          ya da <Link href="/pazar/yeni" style={{ fontWeight: 700 }}>ilan ver</Link>.
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {rows.map((r) => {
            const st = STATUS_TR[r.status];
            return (
              <Link
                key={r.id}
                href={`/pazar/${r.id}`}
                style={{
                  display: "flex", gap: 12, alignItems: "center", padding: "12px 16px",
                  borderBottom: "1px solid var(--line)", color: "inherit", fontSize: 14,
                }}
              >
                {r.img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.img} alt="" width={52} height={40} style={{ objectFit: "contain", flex: "none", background: "var(--soft)", borderRadius: 8 }} />
                ) : (
                  <span style={{ fontSize: 24 }}>🧱</span>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.setName}
                  </b>
                  <small style={{ color: "var(--ink3)" }}>
                    {Number(r.priceTry).toLocaleString("tr-TR")} ₺ · {timeAgo(r.createdAt)}
                    {r.status === "sold" && r.soldViaJestbrick ? " · 🧱 JestBrick'te satıldı" : ""}
                  </small>
                </div>
                <span
                  style={{
                    flex: "none", background: st.color, color: "#fff", fontSize: 11,
                    fontWeight: 800, padding: "3px 10px", borderRadius: 99,
                  }}
                >
                  {st.label}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
