import type { MetadataRoute } from "next";
import { desc, eq, sql } from "drizzle-orm";
import { db, envReady, schema } from "@/db";

export const revalidate = 86400; // günde bir yeniden üret

const BASE = "https://jestbrick.com";

/**
 * Tek sitemap: statikler + tüm katalog setleri (~20k) + aktif ilanlar +
 * forum konuları + herkese açık profiller. 50k URL sınırının altında.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const statics: MetadataRoute.Sitemap = [
    { url: BASE, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/setler`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/pazar`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE}/forum`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE}/talepler`, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/uyeler`, changeFrequency: "daily", priority: 0.5 },
  ];
  if (!envReady()) return statics;

  const [sets, listings, topics, profiles] = await Promise.all([
    db()
      .select({ setNum: schema.sets.setNum, lastModified: schema.sets.lastModified })
      .from(schema.sets),
    db()
      .select({ id: schema.listings.id, createdAt: schema.listings.createdAt })
      .from(schema.listings)
      .where(sql`${schema.listings.status} in ('active', 'reserved')`)
      .orderBy(desc(schema.listings.createdAt))
      .limit(5000),
    db()
      .select({ id: schema.topics.id, lastPostAt: schema.topics.lastPostAt })
      .from(schema.topics)
      .orderBy(desc(schema.topics.lastPostAt))
      .limit(5000),
    db()
      .select({ handle: schema.users.handle })
      .from(schema.users)
      .where(eq(schema.users.profilePublic, true))
      .limit(5000),
  ]);

  return [
    ...statics,
    ...sets.map((s) => ({
      url: `${BASE}/setler/${s.setNum}`,
      lastModified: s.lastModified ?? undefined,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...listings.map((l) => ({
      url: `${BASE}/pazar/${l.id}`,
      lastModified: l.createdAt,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...topics.map((t) => ({
      url: `${BASE}/forum/konu/${t.id}`,
      lastModified: t.lastPostAt,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...profiles.map((p) => ({
      url: `${BASE}/u/${p.handle}`,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
