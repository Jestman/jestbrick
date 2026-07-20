import { NextResponse } from "next/server";
import { db, envReady, schema } from "@/db";
import { isNotNull, sql } from "drizzle-orm";

export const maxDuration = 60;

type BricksetSet = { number: string; numberVariant: number; exitDate?: string };

/**
 * Günlük Brickset artımlı senkronu (vercel.json cron'u çağırır).
 * Son 3 günde güncellenen setlerin emeklilik tarihlerini işler.
 * Tam katalog taraması için: npm run sync:brickset -- --full (yerelde).
 */
export async function GET(req: Request) {
  // Vercel cron'u CRON_SECRET'ı Bearer olarak gönderir
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "yetkisiz" }, { status: 401 });
  }
  if (!envReady() || !process.env.BRICKSET_API_KEY) {
    return NextResponse.json({ error: "ortam eksik" }, { status: 500 });
  }

  // rate-limit sayaçlarının süresi geçen satırlarını temizle (günlük bakım)
  await db().execute(sql`delete from public.rate_limits where resets_at < now()`);

  const since = new Date(Date.now() - 3 * 86400_000).toISOString().slice(0, 10);
  let page = 1;
  let updated = 0;

  for (;;) {
    const url =
      "https://brickset.com/api/v3.asmx/getSets?apiKey=" +
      encodeURIComponent(process.env.BRICKSET_API_KEY) +
      "&userHash=&params=" +
      encodeURIComponent(JSON.stringify({ updatedSince: since, pageSize: 500, pageNumber: page }));
    const res = await fetch(url);
    const data = (await res.json()) as { status: string; message?: string; sets?: BricksetSet[] };
    if (data.status !== "success") {
      return NextResponse.json({ error: data.message ?? "brickset hatası", updated }, { status: 502 });
    }

    const sets = data.sets ?? [];
    // Sadece güvenli karakterler dizi sabitine girer (drizzle sql'i JS dizisini
    // tek parametre yerine ($1,$2,…) diye açtığından {a,b,c} literal kullanılır)
    const withExit = sets.filter(
      (s) => s.exitDate && /^[0-9]+$/.test(s.number) && Number.isInteger(s.numberVariant)
    );
    if (withExit.length > 0) {
      const setNums = `{${withExit.map((s) => `${s.number}-${s.numberVariant}`).join(",")}}`;
      const exits = `{${withExit.map((s) => s.exitDate!.slice(0, 10)).join(",")}}`;
      const r = await db().execute(sql`
        update sets set retired_at = v.exit
        from unnest(${setNums}::text[], ${exits}::date[]) as v(set_num, exit)
        where sets.set_num = v.set_num
          and sets.retired_at is distinct from v.exit
          and v.exit <= current_date
      `);
      updated += (r as unknown as { count?: number }).count ?? 0;
    }
    if (sets.length < 500 || page >= 5) break; // güvenlik: en fazla 5 sayfa/gün
    page++;
  }

  const [{ retiredTotal }] = await db()
    .select({ retiredTotal: sql<number>`count(*)::int` })
    .from(schema.sets)
    .where(isNotNull(schema.sets.retiredAt));

  return NextResponse.json({ ok: true, since, updated, retiredTotal });
}
