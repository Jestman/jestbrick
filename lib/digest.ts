import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Haftalık özet e-postası. RESEND_API_KEY + DIGEST_FROM tanımlıysa çalışır;
 * yoksa sessizce atlanır (aktifleştirme: Resend hesabı + jestbrick.com domain
 * doğrulaması + Vercel env). Pazartesi sabahları rebrickable cron'u tetikler.
 */
export async function sendWeeklyDigests(): Promise<{ sent: number; skipped: string | null }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.DIGEST_FROM; // örn: "JestBrick <ozet@jestbrick.com>"
  if (!key || !from) return { sent: 0, skipped: "RESEND_API_KEY/DIGEST_FROM tanımsız" };

  // Üye başına haftalık sinyaller (yasaklılar hariç; sinyali olmayana mail yok)
  const rows = await db().execute<{
    email: string;
    display_name: string;
    handle: string;
    unread: number;
    matches: number;
    new_followers: number;
  }>(sql`
    select
      au.email,
      u.display_name,
      u.handle,
      (select count(*)::int from conversation_participants cp
        where cp.user_id = u.id and exists (
          select 1 from messages m
          where m.conversation_id = cp.conversation_id
            and m.sender_id <> u.id
            and (cp.last_read_at is null or m.created_at > cp.last_read_at)
        )) as unread,
      (select count(*)::int from listings l
        join wishlist_items wi on wi.set_num = l.set_num and wi.user_id = u.id
        where l.status = 'active' and l.created_at > now() - interval '7 days'
          and l.seller_id <> u.id) as matches,
      (select count(*)::int from follows f
        where f.followee_id = u.id and f.created_at > now() - interval '7 days') as new_followers
    from users u
    join auth.users au on au.id = u.id
    where u.banned_at is null and au.email is not null
  `);

  let sent = 0;
  for (const r of rows) {
    if (r.unread === 0 && r.matches === 0 && r.new_followers === 0) continue;

    const lines = [
      `Merhaba ${r.display_name || "@" + r.handle},`,
      "",
      "Bu hafta JestBrick'te seni bekleyenler:",
      r.unread > 0 ? `• 💬 ${r.unread} konuşmada okunmamış mesajın var` : null,
      r.matches > 0 ? `• 🔥 İstek listendeki setler için ${r.matches} yeni ilan açıldı` : null,
      r.new_followers > 0 ? `• 👤 ${r.new_followers} yeni takipçin var` : null,
      "",
      "Hepsine buradan bak: https://jestbrick.com",
      "",
      "— JestBrick · Koleksiyoncuların buluşma noktası",
      "Bu özeti almak istemiyorsan profil ayarlarından kapatabilirsin (yakında).",
    ]
      .filter((l) => l !== null)
      .join("\n");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: r.email,
        subject: "🧱 Haftalık JestBrick özetin",
        text: lines,
      }),
    });
    if (res.ok) sent++;
    await new Promise((r2) => setTimeout(r2, 600)); // Resend hız sınırına saygı
  }
  return { sent, skipped: null };
}
