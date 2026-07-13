import "server-only";
import { and, asc, desc, eq, gte, ilike, lte, sql } from "drizzle-orm";
import { db, schema } from "@/db";

export type ListingFilters = {
  setNum?: string;
  sellerId?: string;
  condition?: string; // sealed | complete | used
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string; // yeni | ucuz | pahali
};

/** Pazar vitrini: aktif + rezerve ilanlar (satılan/kaldırılan gizli), filtreli. */
export async function activeListings(opts: ListingFilters = {}) {
  const cond = [sql`${schema.listings.status} in ('active', 'reserved')`];
  if (opts.setNum) cond.push(eq(schema.listings.setNum, opts.setNum));
  if (opts.sellerId) cond.push(eq(schema.listings.sellerId, opts.sellerId));
  if (opts.condition && schema.listingCondition.enumValues.includes(opts.condition as never))
    cond.push(eq(schema.listings.condition, opts.condition as (typeof schema.listingCondition.enumValues)[number]));
  if (opts.city) cond.push(ilike(schema.listings.city, `%${opts.city}%`));
  if (opts.minPrice && Number.isFinite(opts.minPrice)) cond.push(gte(schema.listings.priceTry, String(opts.minPrice)));
  if (opts.maxPrice && Number.isFinite(opts.maxPrice)) cond.push(lte(schema.listings.priceTry, String(opts.maxPrice)));

  const order =
    opts.sort === "ucuz"
      ? asc(schema.listings.priceTry)
      : opts.sort === "pahali"
        ? desc(schema.listings.priceTry)
        : desc(schema.listings.createdAt);

  return db()
    .select({
      id: schema.listings.id,
      setNum: schema.listings.setNum,
      priceTry: schema.listings.priceTry,
      condition: schema.listings.condition,
      city: schema.listings.city,
      ships: schema.listings.ships,
      status: schema.listings.status,
      createdAt: schema.listings.createdAt,
      setName: schema.sets.name,
      imagePath: schema.sets.imagePath,
      imageUrl: schema.sets.imageUrl,
      sellerId: schema.users.id,
      sellerHandle: schema.users.handle,
      sellerName: schema.users.displayName,
    })
    .from(schema.listings)
    .innerJoin(schema.sets, eq(schema.listings.setNum, schema.sets.setNum))
    .innerJoin(schema.users, eq(schema.listings.sellerId, schema.users.id))
    .where(and(...cond))
    .orderBy(order)
    .limit(60);
}

/** Tek ilan + set + satıcı + satıcının puan ortalaması. */
export async function getListing(id: string) {
  const rows = await db()
    .select({
      listing: schema.listings,
      setName: schema.sets.name,
      imagePath: schema.sets.imagePath,
      imageUrl: schema.sets.imageUrl,
      numParts: schema.sets.numParts,
      msrpTry: schema.sets.msrpTry,
      sellerHandle: schema.users.handle,
      sellerName: schema.users.displayName,
      sellerCity: schema.users.city,
      sellerAvatar: schema.users.avatarPath,
      sellerSince: schema.users.createdAt,
    })
    .from(schema.listings)
    .innerJoin(schema.sets, eq(schema.listings.setNum, schema.sets.setNum))
    .innerJoin(schema.users, eq(schema.listings.sellerId, schema.users.id))
    .where(eq(schema.listings.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/** Satıcı istatistikleri: puan ortalaması + tamamlanan satış sayısı. */
export async function sellerStats(sellerId: string) {
  const [row] = await db()
    .select({
      avgScore: sql<string | null>`avg(${schema.sellerRatings.score})`,
      ratingCount: sql<number>`count(*)::int`,
    })
    .from(schema.sellerRatings)
    .where(eq(schema.sellerRatings.sellerId, sellerId));
  const [sold] = await db()
    .select({ soldCount: sql<number>`count(*)::int` })
    .from(schema.listings)
    .where(and(eq(schema.listings.sellerId, sellerId), eq(schema.listings.status, "sold")));
  return {
    avgScore: row?.avgScore ? Number(row.avgScore) : null,
    ratingCount: row?.ratingCount ?? 0,
    soldCount: sold?.soldCount ?? 0,
  };
}
