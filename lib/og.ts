import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";

/** ImageResponse (satori) için Türkçe glif destekli gömülü fontlar. */
let fontsCache: { regular: Buffer; bold: Buffer } | null = null;
export async function ogFonts() {
  if (!fontsCache) {
    const dir = path.join(process.cwd(), "assets", "fonts");
    const [regular, bold] = await Promise.all([
      readFile(path.join(dir, "NotoSans-Regular.ttf")),
      readFile(path.join(dir, "NotoSans-ExtraBold.ttf")),
    ]);
    fontsCache = { regular, bold };
  }
  return fontsCache;
}

export type ProfileCard = {
  name: string;
  handle: string;
  city: string | null;
  setCount: number;
  totalParts: number;
  figCount: number;
  topSets: string[];
  profilePublic: boolean;
  userId: string;
};

/** Paylaşım görselleri için profil özeti (yalnızca public görünürlük). */
export async function profileCard(handle: string): Promise<ProfileCard | null> {
  const [u] = await db()
    .select()
    .from(schema.users)
    .where(eq(schema.users.handle, handle.toLowerCase()))
    .limit(1);
  if (!u) return null;

  const [[stats], figRows, topSets] = await Promise.all([
    db()
      .select({
        setCount: sql<number>`count(*)::int`,
        totalParts: sql<number>`coalesce(sum(${schema.sets.numParts}), 0)::int`,
      })
      .from(schema.collectionItems)
      .innerJoin(schema.sets, eq(schema.collectionItems.setNum, schema.sets.setNum))
      .where(and(eq(schema.collectionItems.userId, u.id), eq(schema.collectionItems.visibility, "public"))),
    db()
      .select({
        n: sql<number>`coalesce(sum(${schema.setMinifigs.quantity}), 0)::int
          + coalesce((select sum(delta) from collection_minifigs cm where cm.user_id = ${u.id}), 0)::int`,
      })
      .from(schema.collectionItems)
      .innerJoin(schema.setMinifigs, eq(schema.collectionItems.setNum, schema.setMinifigs.setNum))
      .where(eq(schema.collectionItems.userId, u.id)),
    db()
      .select({ name: schema.sets.name })
      .from(schema.collectionItems)
      .innerJoin(schema.sets, eq(schema.collectionItems.setNum, schema.sets.setNum))
      .where(and(eq(schema.collectionItems.userId, u.id), eq(schema.collectionItems.visibility, "public")))
      .orderBy(desc(schema.sets.numParts))
      .limit(3),
  ]);

  return {
    name: u.displayName || `@${u.handle}`,
    handle: u.handle,
    city: u.city,
    setCount: stats?.setCount ?? 0,
    totalParts: stats?.totalParts ?? 0,
    figCount: Math.max(0, figRows[0]?.n ?? 0),
    topSets: topSets.map((s) => s.name),
    profilePublic: u.profilePublic,
    userId: u.id,
  };
}
