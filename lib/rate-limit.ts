import "server-only";
import { headers } from "next/headers";
import { sql } from "drizzle-orm";
import { db } from "@/db";

/** Ortak limit mesajı — form durumuna koymak için. */
export const RATE_MSG = "Çok sık deneme yaptın — lütfen birkaç dakika sonra tekrar dene.";

/** Vercel arkasında gerçek istemci IP'si (yoksa sabit anahtar → yine limitlenir). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "ip-yok";
}

/**
 * Sabit pencereli sayaç (rate_limits tablosu). true = izinli, false = limit aşıldı.
 * Pencere dolunca sayaç aynı satır üzerinde sıfırlanır; süresi geçmiş satırları
 * günlük cron temizler. DB hatasında izin verir (fail-open): erişilebilirlik önce.
 */
export async function rateLimit(bucket: string, max: number, windowSec: number): Promise<boolean> {
  try {
    const rows = await db().execute(sql`
      insert into rate_limits (bucket, count, resets_at)
      values (${bucket}, 1, now() + make_interval(secs => ${windowSec}))
      on conflict (bucket) do update set
        count = case when rate_limits.resets_at < now() then 1 else rate_limits.count + 1 end,
        resets_at = case when rate_limits.resets_at < now()
                         then now() + make_interval(secs => ${windowSec})
                         else rate_limits.resets_at end
      returning count
    `);
    const count = Number((rows as unknown as { count: number }[])[0]?.count ?? 0);
    return count <= max;
  } catch {
    return true;
  }
}
