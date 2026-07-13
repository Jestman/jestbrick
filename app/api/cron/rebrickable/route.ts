import { NextResponse } from "next/server";
import { inArray, sql } from "drizzle-orm";
import { db, envReady, schema } from "@/db";

export const maxDuration = 60;

type RbSet = {
  set_num: string;
  name: string;
  year: number;
  theme_id: number;
  num_parts: number;
  set_img_url: string | null;
  last_modified_dt: string;
};

/**
 * Günlük Rebrickable artımlı senkronu: son değişen/eklenen setleri çeker.
 * Yeni bir set duyurulduğunda ertesi sabah katalogda görünür.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "yetkisiz" }, { status: 401 });
  }
  if (!envReady() || !process.env.REBRICKABLE_API_KEY) {
    return NextResponse.json({ error: "ortam eksik" }, { status: 500 });
  }

  const headers = { Authorization: `key ${process.env.REBRICKABLE_API_KEY}` };
  const collected: RbSet[] = [];
  let url =
    "https://rebrickable.com/api/v3/lego/sets/?ordering=-last_modified_dt&page_size=200";
  const cutoff = Date.now() - 3 * 86400_000; // son 3 gün

  // en fazla 3 sayfa (600 set) — günlük değişim bunun çok altında
  for (let page = 0; page < 3 && url; page++) {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      return NextResponse.json({ error: `rebrickable ${res.status}`, upserted: 0 }, { status: 502 });
    }
    const data = (await res.json()) as { next: string | null; results: RbSet[] };
    const fresh = data.results.filter((s) => new Date(s.last_modified_dt).getTime() >= cutoff);
    collected.push(...fresh);
    // sayfa tamamen eskiyse dur
    url = fresh.length === data.results.length && data.next ? data.next : "";
  }

  if (collected.length === 0) return NextResponse.json({ ok: true, upserted: 0 });

  // bilinmeyen temalar önce eklenmeli (FK)
  const themeIds = [...new Set(collected.map((s) => s.theme_id))];
  const known = await db()
    .select({ id: schema.themes.id })
    .from(schema.themes)
    .where(inArray(schema.themes.id, themeIds));
  const knownSet = new Set(known.map((k) => k.id));
  for (const tid of themeIds.filter((t) => !knownSet.has(t))) {
    const res = await fetch(`https://rebrickable.com/api/v3/lego/themes/${tid}/`, { headers });
    if (res.ok) {
      const t = (await res.json()) as { id: number; name: string; parent_id: number | null };
      await db()
        .insert(schema.themes)
        .values({ id: t.id, name: t.name, parentId: t.parent_id })
        .onConflictDoNothing();
    }
  }

  let upserted = 0;
  for (const s of collected) {
    await db()
      .insert(schema.sets)
      .values({
        setNum: s.set_num,
        name: s.name,
        year: s.year,
        themeId: knownSet.has(s.theme_id) || themeIds.includes(s.theme_id) ? s.theme_id : null,
        numParts: s.num_parts,
        imageUrl: s.set_img_url,
        lastModified: new Date(s.last_modified_dt),
      })
      .onConflictDoUpdate({
        target: schema.sets.setNum,
        set: {
          name: s.name,
          year: s.year,
          numParts: s.num_parts,
          imageUrl: s.set_img_url,
          lastModified: new Date(s.last_modified_dt),
        },
      });
    upserted++;
  }

  return NextResponse.json({ ok: true, upserted });
}
