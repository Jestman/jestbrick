import { NextResponse } from "next/server";
import { asc, desc, ilike, sql } from "drizzle-orm";
import { db, envReady, schema } from "@/db";

/** Canlı arama önerileri: sayı → set numarası öneki, metin → ad araması. */
export async function GET(req: Request) {
  if (!envReady()) return NextResponse.json({ items: [] });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ items: [] });

  const isNumeric = /^\d+$/.test(q);
  const items = await db()
    .select({
      setNum: schema.sets.setNum,
      name: schema.sets.name,
      year: schema.sets.year,
      img: sql<string | null>`coalesce(${schema.sets.imagePath}, ${schema.sets.imageUrl})`,
    })
    .from(schema.sets)
    .where(
      isNumeric
        ? ilike(schema.sets.setNum, `${q}%`)
        : ilike(schema.sets.name, `%${q}%`)
    )
    .orderBy(
      // ada q ile başlayanlar önce, sonra yeni yıllar
      isNumeric ? asc(schema.sets.setNum) : sql`(${schema.sets.name} ilike ${q + "%"}) desc`,
      desc(schema.sets.year)
    )
    .limit(5);

  return NextResponse.json(
    { items },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } }
  );
}
