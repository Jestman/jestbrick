"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne, sql } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { db, schema } from "@/db";
import { findOrCreateDirect } from "@/lib/messages/helpers";
import { notify } from "@/lib/notify";

const MAX_PRICE = 1_000_000;
const CONDITIONS = new Set(schema.listingCondition.enumValues);
const MAX_PHOTOS = 4;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris");
  return user;
}

export type ListingFormState = { error?: string } | undefined;

/** İlan oluşturur ve seti isteyenlere (notify_on_listing) bildirim düşürür. */
export async function createListing(
  _prev: ListingFormState,
  formData: FormData
): Promise<ListingFormState> {
  const user = await requireUser();

  const setNum = String(formData.get("setNum") ?? "");
  const price = Number(formData.get("price"));
  const condition = String(formData.get("condition") ?? "");
  const description = String(formData.get("description") ?? "").trim().slice(0, 2000);
  const city = String(formData.get("city") ?? "").trim().slice(0, 60) || null;
  const ships = formData.get("ships") === "on";

  if (!setNum) return { error: "Bir set seçmelisin." };
  if (!Number.isFinite(price) || price < 1 || price > MAX_PRICE)
    return { error: "Fiyat 1 ₺ ile 1.000.000 ₺ arasında olmalı." };
  if (!CONDITIONS.has(condition as (typeof schema.listingCondition.enumValues)[number]))
    return { error: "Geçerli bir durum seç." };

  const [setRow] = await db()
    .select({ name: schema.sets.name })
    .from(schema.sets)
    .where(eq(schema.sets.setNum, setNum));
  if (!setRow) return { error: "Set katalogda bulunamadı." };

  const files = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0 && f.type.startsWith("image/"))
    .slice(0, MAX_PHOTOS);
  if (files.some((f) => f.size > MAX_PHOTO_BYTES))
    return { error: "Fotoğraflar en fazla 8 MB olabilir." };

  const [listing] = await db()
    .insert(schema.listings)
    .values({
      sellerId: user.id,
      setNum,
      priceTry: String(price),
      condition: condition as (typeof schema.listingCondition.enumValues)[number],
      description,
      city,
      ships,
    })
    .returning({ id: schema.listings.id });

  if (files.length > 0) {
    const admin = createAdminClient();
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const ext = (f.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
      const path = `listings/${listing.id}/${i}.${ext}`;
      const { error } = await admin.storage
        .from("media")
        .upload(path, Buffer.from(await f.arrayBuffer()), { contentType: f.type, upsert: true });
      if (!error) {
        await db()
          .insert(schema.listingImages)
          .values({ listingId: listing.id, storagePath: path, position: i });
      }
    }
  }

  // Eşleştirme köprüsü: bu seti isteyip ilan bildirimi açık olanlara haber ver
  const wishers = await db()
    .select({ userId: schema.wishlistItems.userId })
    .from(schema.wishlistItems)
    .where(
      and(
        eq(schema.wishlistItems.setNum, setNum),
        eq(schema.wishlistItems.notifyOnListing, true),
        ne(schema.wishlistItems.userId, user.id)
      )
    );
  for (const w of wishers) {
    await notify(w.userId, user.id, "wishlist_listing", {
      listingId: listing.id,
      setNum,
      setName: setRow.name,
      price,
    });
  }

  redirect(`/pazar/${listing.id}`);
}

/** İlan durumunu değiştirir (sadece sahibi): active/reserved/sold/removed. */
export async function setListingStatus(formData: FormData) {
  const id = String(formData.get("listingId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !new Set(schema.listingStatus.enumValues).has(status as never)) return;
  const user = await requireUser();

  await db()
    .update(schema.listings)
    .set({
      status: status as (typeof schema.listingStatus.enumValues)[number],
      soldAt: status === "sold" ? new Date() : null,
      // "JestBrick üzerinden sattım" işareti yalnızca satıldı anında anlamlı
      soldViaJestbrick: status === "sold" ? formData.get("via") === "on" : false,
    })
    .where(and(eq(schema.listings.id, id), eq(schema.listings.sellerId, user.id)));

  revalidatePath(`/pazar/${id}`);
  revalidatePath("/pazar");
  revalidatePath("/pazar/ilanlarim");
}

/** Alıcı → satıcı: ilan üstünden konuşma başlatır, satıcıya bildirim düşer. */
export async function contactSeller(formData: FormData) {
  const listingId = String(formData.get("listingId") ?? "");
  if (!listingId) return;
  const user = await requireUser();

  const [l] = await db()
    .select({
      sellerId: schema.listings.sellerId,
      setNum: schema.listings.setNum,
      priceTry: schema.listings.priceTry,
      setName: schema.sets.name,
    })
    .from(schema.listings)
    .innerJoin(schema.sets, eq(schema.listings.setNum, schema.sets.setNum))
    .where(eq(schema.listings.id, listingId));
  if (!l || l.sellerId === user.id) return;

  const convId = await findOrCreateDirect(user.id, l.sellerId);
  await db().insert(schema.messages).values({
    conversationId: convId,
    senderId: user.id,
    kind: "user",
    body: `Merhaba! ${l.setName} (#${l.setNum.replace(/-1$/, "")}) ilanınla ilgileniyorum — ${Number(
      l.priceTry
    ).toLocaleString("tr-TR")} ₺. Detay konuşabilir miyiz? 🧱`,
  });
  await notify(l.sellerId, user.id, "listing_interest", { listingId, setName: l.setName });

  redirect(`/mesajlar?k=${convId}`);
}

/** Satılan ilanın alıcı tarafı satıcıyı puanlar (ilan başına 1 kez, DB UNIQUE). */
export async function rateSeller(formData: FormData) {
  const listingId = String(formData.get("listingId") ?? "");
  const score = Number(formData.get("score"));
  const comment = String(formData.get("comment") ?? "").trim().slice(0, 500) || null;
  if (!listingId || !Number.isInteger(score) || score < 1 || score > 5) return;
  const user = await requireUser();

  const [l] = await db()
    .select({ sellerId: schema.listings.sellerId, status: schema.listings.status })
    .from(schema.listings)
    .where(eq(schema.listings.id, listingId));
  if (!l || l.status !== "sold" || l.sellerId === user.id) return;

  // yalnızca satıcıyla gerçekten yazışmış biri puanlayabilsin
  const talked = await db()
    .select({ id: schema.conversations.id })
    .from(schema.conversations)
    .where(
      and(
        sql`exists (select 1 from conversation_participants p1
             where p1.conversation_id = ${schema.conversations.id} and p1.user_id = ${user.id})`,
        sql`exists (select 1 from conversation_participants p2
             where p2.conversation_id = ${schema.conversations.id} and p2.user_id = ${l.sellerId})`
      )
    )
    .limit(1);
  if (talked.length === 0) return;

  await db()
    .insert(schema.sellerRatings)
    .values({ listingId, raterId: user.id, sellerId: l.sellerId, score, comment })
    .onConflictDoNothing();

  revalidatePath(`/pazar/${listingId}`);
}
