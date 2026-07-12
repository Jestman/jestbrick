"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/db";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris");
  return user;
}

export async function addToCollection(formData: FormData) {
  const setNum = String(formData.get("setNum") ?? "");
  if (!setNum) return;
  const user = await requireUser();

  await db()
    .insert(schema.collectionItems)
    .values({ userId: user.id, setNum })
    .onConflictDoNothing();

  revalidatePath(`/setler/${setNum}`);
  revalidatePath("/koleksiyon");
}

export async function removeFromCollection(formData: FormData) {
  const setNum = String(formData.get("setNum") ?? "");
  if (!setNum) return;
  const user = await requireUser();

  await db()
    .delete(schema.collectionItems)
    .where(
      and(
        eq(schema.collectionItems.userId, user.id),
        eq(schema.collectionItems.setNum, setNum)
      )
    );

  revalidatePath(`/setler/${setNum}`);
  revalidatePath("/koleksiyon");
}

/* ---------------- tekil minifigürler ---------------- */

/** Setlerden türetilen adet (koleksiyondaki setlerin içindeki bu figür sayısı). */
async function derivedFigCount(userId: string, figNum: string): Promise<number> {
  const [row] = await db()
    .select({
      q: sql<number>`coalesce(sum(${schema.setMinifigs.quantity}), 0)::int`,
    })
    .from(schema.collectionItems)
    .innerJoin(
      schema.setMinifigs,
      eq(schema.collectionItems.setNum, schema.setMinifigs.setNum)
    )
    .where(
      and(
        eq(schema.collectionItems.userId, userId),
        eq(schema.setMinifigs.figNum, figNum)
      )
    );
  return row?.q ?? 0;
}

export async function addMinifig(formData: FormData) {
  const figNum = String(formData.get("figNum") ?? "");
  const back = String(formData.get("back") ?? "/koleksiyon");
  if (!figNum) return;
  const user = await requireUser();

  await db()
    .insert(schema.collectionMinifigs)
    .values({ userId: user.id, figNum, delta: 1 })
    .onConflictDoUpdate({
      target: [schema.collectionMinifigs.userId, schema.collectionMinifigs.figNum],
      set: { delta: sql`${schema.collectionMinifigs.delta} + 1` },
    });

  revalidatePath(back);
  revalidatePath("/koleksiyon");
}

export async function removeMinifig(formData: FormData) {
  const figNum = String(formData.get("figNum") ?? "");
  const back = String(formData.get("back") ?? "/koleksiyon");
  if (!figNum) return;
  const user = await requireUser();

  const derived = await derivedFigCount(user.id, figNum);
  const [cur] = await db()
    .select({ delta: schema.collectionMinifigs.delta })
    .from(schema.collectionMinifigs)
    .where(
      and(
        eq(schema.collectionMinifigs.userId, user.id),
        eq(schema.collectionMinifigs.figNum, figNum)
      )
    );
  const total = derived + (cur?.delta ?? 0);
  if (total <= 0) return; // zaten sıfırda — eksiye düşme

  await db()
    .insert(schema.collectionMinifigs)
    .values({ userId: user.id, figNum, delta: -1 })
    .onConflictDoUpdate({
      target: [schema.collectionMinifigs.userId, schema.collectionMinifigs.figNum],
      set: { delta: sql`${schema.collectionMinifigs.delta} - 1` },
    });

  revalidatePath(back);
  revalidatePath("/koleksiyon");
}

/* ---------------- istek listesi ---------------- */

export async function addToWishlist(formData: FormData) {
  const setNum = String(formData.get("setNum") ?? "");
  if (!setNum) return;
  const user = await requireUser();

  await db()
    .insert(schema.wishlistItems)
    .values({ userId: user.id, setNum })
    .onConflictDoNothing();

  revalidatePath(`/setler/${setNum}`);
  revalidatePath("/koleksiyon");
}

export async function removeFromWishlist(formData: FormData) {
  const setNum = String(formData.get("setNum") ?? "");
  if (!setNum) return;
  const user = await requireUser();

  await db()
    .delete(schema.wishlistItems)
    .where(
      and(
        eq(schema.wishlistItems.userId, user.id),
        eq(schema.wishlistItems.setNum, setNum)
      )
    );

  revalidatePath(`/setler/${setNum}`);
  revalidatePath("/koleksiyon");
}

/** "Aldım!" — istek listesinden çıkar, koleksiyona ekle. */
export async function wishToCollection(formData: FormData) {
  const setNum = String(formData.get("setNum") ?? "");
  if (!setNum) return;
  const user = await requireUser();

  await db()
    .delete(schema.wishlistItems)
    .where(
      and(
        eq(schema.wishlistItems.userId, user.id),
        eq(schema.wishlistItems.setNum, setNum)
      )
    );
  await db()
    .insert(schema.collectionItems)
    .values({ userId: user.id, setNum })
    .onConflictDoNothing();

  revalidatePath(`/setler/${setNum}`);
  revalidatePath("/koleksiyon");
}
