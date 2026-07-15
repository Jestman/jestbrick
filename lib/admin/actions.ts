"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireModerator, requireStaff } from "./guards";

/* ---------------- staff: rol atama & site anahtarları ---------------- */

/** Rol atar (sadece staff). Staff kendini düşüremez — kilitlenme koruması. */
export async function setUserRole(formData: FormData) {
  const me = await requireStaff();
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!userId || !new Set(schema.userRole.enumValues).has(role as never)) return;
  if (userId === me.userId && role !== "staff") return;

  await db()
    .update(schema.users)
    .set({ role: role as (typeof schema.userRole.enumValues)[number] })
    .where(eq(schema.users.id, userId));
  revalidatePath("/yonetim");
}

/** Hesabı askıya alır / askıyı kaldırır (sadece staff; kendine uygulanamaz). */
export async function toggleBan(formData: FormData) {
  const me = await requireStaff();
  const userId = String(formData.get("userId") ?? "");
  const to = formData.get("to") === "true";
  if (!userId || userId === me.userId) return;

  await db()
    .update(schema.users)
    .set({ bannedAt: to ? new Date() : null })
    .where(eq(schema.users.id, userId));
  revalidatePath("/yonetim");
}

export async function toggleFlag(formData: FormData) {
  await requireStaff();
  const key = String(formData.get("key") ?? "");
  const to = formData.get("to") === "true";
  if (!["market_enabled", "forum_enabled", "signup_enabled"].includes(key)) return;

  await db()
    .insert(schema.siteSettings)
    .values({ key, value: to, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: schema.siteSettings.key,
      set: { value: to, updatedAt: new Date() },
    });
  revalidatePath("/", "layout"); // nav + kapatılan sayfalar her yerde tazelensin
}

/* ---------------- moderasyon: şikayetler ---------------- */

export async function resolveReport(formData: FormData) {
  await requireModerator();
  const id = String(formData.get("reportId") ?? "");
  if (!id) return;
  await db()
    .update(schema.reports)
    .set({ resolvedAt: new Date() })
    .where(eq(schema.reports.id, id));
  revalidatePath("/yonetim");
}

/* ---------------- moderasyon: forum ---------------- */

export async function modTopic(formData: FormData) {
  await requireModerator();
  const id = String(formData.get("topicId") ?? "");
  const op = String(formData.get("op") ?? "");
  if (!id) return;

  if (op === "pin" || op === "unpin") {
    await db().update(schema.topics).set({ pinned: op === "pin" }).where(eq(schema.topics.id, id));
  } else if (op === "lock" || op === "unlock") {
    await db().update(schema.topics).set({ locked: op === "lock" }).where(eq(schema.topics.id, id));
  } else if (op === "delete") {
    await db().delete(schema.topics).where(eq(schema.topics.id, id)); // cascade: topic_posts
    revalidatePath("/forum");
    return;
  }
  revalidatePath(`/forum/konu/${id}`);
  revalidatePath("/forum");
}

/** Tek forum mesajı siler (ilk mesaj hariç — onun için başlığı sil). */
export async function deleteTopicPost(formData: FormData) {
  await requireModerator();
  const id = String(formData.get("postId") ?? "");
  const topicId = String(formData.get("topicId") ?? "");
  if (!id) return;
  await db().delete(schema.topicPosts).where(eq(schema.topicPosts.id, id));
  if (topicId) revalidatePath(`/forum/konu/${topicId}`);
}

/** Akış paylaşımını siler (moderasyon) — cascade: medya, beğeni, yorumlar. */
export async function deletePostAdmin(formData: FormData) {
  await requireModerator();
  const id = String(formData.get("postId") ?? "");
  if (!id) return;
  await db().delete(schema.posts).where(eq(schema.posts.id, id));
  revalidatePath("/yonetim");
  revalidatePath("/");
}

/* ---------------- moderasyon: pazar ---------------- */

export async function removeListingAdmin(formData: FormData) {
  await requireModerator();
  const id = String(formData.get("listingId") ?? "");
  if (!id) return;
  await db()
    .update(schema.listings)
    .set({ status: "removed" })
    .where(eq(schema.listings.id, id));
  revalidatePath(`/pazar/${id}`);
  revalidatePath("/pazar");
}
