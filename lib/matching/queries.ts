import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";

/** Bir seti isteyen, ulaşılabilir üyeler (bütçe girenler önde). */
export async function wishersOf(setNum: string, excludeUserId?: string) {
  return db()
    .select({
      userId: schema.wishlistItems.userId,
      maxPriceTry: schema.wishlistItems.maxPriceTry,
      handle: schema.users.handle,
      displayName: schema.users.displayName,
      avatarPath: schema.users.avatarPath,
      city: schema.users.city,
    })
    .from(schema.wishlistItems)
    .innerJoin(schema.users, eq(schema.wishlistItems.userId, schema.users.id))
    .where(
      and(
        eq(schema.wishlistItems.setNum, setNum),
        eq(schema.wishlistItems.contactable, true),
        eq(schema.users.wishlistPublic, true),
        excludeUserId ? sql`${schema.wishlistItems.userId} <> ${excludeUserId}` : sql`true`
      )
    )
    .orderBy(sql`${schema.wishlistItems.maxPriceTry} desc nulls last`, schema.wishlistItems.createdAt);
}
