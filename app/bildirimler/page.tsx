import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, isNull, and } from "drizzle-orm";
import { db, envReady, schema } from "@/db";
import { getUser } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/format";

export const metadata = { title: "Bildirimler" };

const TEXT: Record<string, (p: Record<string, string>) => string> = {
  follow: () => "seni takip etmeye başladı",
  like: () => "paylaşımını beğendi",
  comment: (p) => `paylaşımına yorum yaptı: “${p.excerpt ?? ""}”`,
  wishlist_listing: (p) =>
    `istek listendeki ${p.setName ?? "set"} için ilan açtı${
      p.price ? ` — ${Number(p.price).toLocaleString("tr-TR")} ₺` : ""
    }`,
  listing_interest: (p) => `${p.setName ? `${p.setName} ` : ""}ilanınla ilgileniyor`,
  demand_on_owned: () => "koleksiyonundaki bir seti arıyor",
  reply: (p) => (p.title ? `“${p.title}” başlığına yanıt yazdı` : "yorumuna yanıt verdi"),
};

const ICON: Record<string, string> = {
  follow: "👤", like: "❤️", comment: "💬",
  wishlist_listing: "🏷️", listing_interest: "🙋", demand_on_owned: "🔥", reply: "↩️",
};

export default async function BildirimlerPage() {
  if (!envReady()) redirect("/");
  const user = await getUser();
  if (!user) redirect("/giris?sonra=/bildirimler");

  const items = await db()
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, user.id))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(50);

  // Sayfa görüntülenince tümünü okundu işaretle
  await db()
    .update(schema.notifications)
    .set({ readAt: new Date() })
    .where(and(eq(schema.notifications.userId, user.id), isNull(schema.notifications.readAt)));

  return (
    <main className="wrap" style={{ maxWidth: 620 }}>
      <h1 className="page">Bildirimler</h1>
      {items.length === 0 ? (
        <div className="notice">Henüz bildirimin yok. Takipçiler ve etkileşimler burada görünecek.</div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {items.map((n) => {
            const p = (n.payload ?? {}) as Record<string, string>;
            const text = TEXT[n.type]?.(p) ?? n.type;
            const fresh = !n.readAt;
            return (
              <div
                key={n.id}
                style={{
                  display: "flex", gap: 12, padding: "13px 17px", alignItems: "flex-start",
                  borderBottom: "1px solid var(--line)", fontSize: 14, lineHeight: 1.45,
                  background: fresh ? "var(--yellow-soft)" : undefined,
                }}
              >
                <span style={{ fontSize: 19, flex: "none" }}>{ICON[n.type] ?? "🔔"}</span>
                <div style={{ flex: 1 }}>
                  {p.actorHandle ? (
                    <Link href={`/u/${p.actorHandle}`} style={{ fontWeight: 700, color: "inherit" }}>
                      {p.actorName || p.actorHandle}
                    </Link>
                  ) : (
                    <b>JestBrick</b>
                  )}{" "}
                  {p.listingId ? (
                    <Link href={`/pazar/${p.listingId}`} style={{ color: "inherit" }}>{text} →</Link>
                  ) : p.topicId ? (
                    <Link href={`/forum/konu/${p.topicId}`} style={{ color: "inherit" }}>{text} →</Link>
                  ) : (
                    text
                  )}
                  <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 2 }}>{timeAgo(n.createdAt)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
