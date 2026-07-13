import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { db, envReady, schema } from "@/db";
import { getUser } from "@/lib/supabase/server";

export const metadata = { title: "Talepler — Set Arayanlar" };

export default async function TaleplerPage() {
  if (!envReady()) redirect("/");
  const user = await getUser();

  // Canlı talep tablosu (bu ölçekte MV yerine doğrudan sayım yeterli ve hep taze)
  const demand = await db()
    .select({
      setNum: schema.wishlistItems.setNum,
      wisherCount: sql<number>`count(*)::int`,
      medianBudget: sql<string | null>`percentile_cont(0.5) within group (order by ${schema.wishlistItems.maxPriceTry})`,
      name: schema.sets.name,
      imagePath: schema.sets.imagePath,
      imageUrl: schema.sets.imageUrl,
      numParts: schema.sets.numParts,
      inMyCollection: user
        ? sql<boolean>`exists (select 1 from collection_items ci
            where ci.user_id = ${user.id} and ci.set_num = ${schema.wishlistItems.setNum})`
        : sql<boolean>`false`,
    })
    .from(schema.wishlistItems)
    .innerJoin(schema.sets, eq(schema.wishlistItems.setNum, schema.sets.setNum))
    .groupBy(
      schema.wishlistItems.setNum,
      schema.sets.name,
      schema.sets.imagePath,
      schema.sets.imageUrl,
      schema.sets.numParts
    )
    .orderBy(desc(sql`count(*)`))
    .limit(60);

  return (
    <main className="wrap">
      <h1 className="page">Talepler — Bu Setleri Arayanlar</h1>
      <div className="notice" style={{ marginBottom: 20 }}>
        💡 Üyelerin istek listeleri burada toplanır. Elindeki set aranıyorsa set sayfasından
        isteyenlere ulaşabilir, günde bir kez toplu “elimde var” mesajı gönderebilirsin.
      </div>
      {demand.length === 0 ? (
        <div className="notice">Henüz istek listesi oluşturan olmadı.</div>
      ) : (
        <div className="setgrid">
          {demand.map((d) => {
            const img = d.imagePath ?? d.imageUrl;
            return (
              <Link key={d.setNum} href={`/setler/${d.setNum}`} className="setcard">
                <div className="img">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt={d.name} loading="lazy" />
                  ) : (
                    <span style={{ fontSize: 40 }}>🧱</span>
                  )}
                </div>
                <div className="meta">
                  <b>{d.name}</b>
                  {/* .setcard .meta b blok görünümlü — satır kırılmasın diye span */}
                  <small>
                    🔥 <span style={{ fontWeight: 800, color: "var(--ink)" }}>{d.wisherCount} kişi</span> arıyor
                    {d.medianBudget ? ` · bütçe ~${Number(d.medianBudget).toLocaleString("tr-TR")} ₺` : ""}
                  </small>
                  {d.inMyCollection && (
                    <small style={{ color: "var(--green)", fontWeight: 700 }}>
                      ✓ koleksiyonunda var — isteyenlere ulaş
                    </small>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
