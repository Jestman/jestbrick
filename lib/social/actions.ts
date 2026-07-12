"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
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

export async function follow(formData: FormData) {
  const followeeId = String(formData.get("userId") ?? "");
  const back = String(formData.get("back") ?? "/");
  if (!followeeId) return;
  const user = await requireUser();
  if (user.id === followeeId) return;

  await db()
    .insert(schema.follows)
    .values({ followerId: user.id, followeeId })
    .onConflictDoNothing();

  revalidatePath(back);
  revalidatePath("/");
}

export async function unfollow(formData: FormData) {
  const followeeId = String(formData.get("userId") ?? "");
  const back = String(formData.get("back") ?? "/");
  if (!followeeId) return;
  const user = await requireUser();

  await db()
    .delete(schema.follows)
    .where(
      and(
        eq(schema.follows.followerId, user.id),
        eq(schema.follows.followeeId, followeeId)
      )
    );

  revalidatePath(back);
  revalidatePath("/");
}

export async function toggleLike(formData: FormData) {
  const postId = String(formData.get("postId") ?? "");
  const back = String(formData.get("back") ?? "/");
  if (!postId) return;
  const user = await requireUser();

  const existing = await db()
    .select({ postId: schema.likes.postId })
    .from(schema.likes)
    .where(and(eq(schema.likes.postId, postId), eq(schema.likes.userId, user.id)))
    .limit(1);

  if (existing.length > 0) {
    await db()
      .delete(schema.likes)
      .where(and(eq(schema.likes.postId, postId), eq(schema.likes.userId, user.id)));
  } else {
    await db()
      .insert(schema.likes)
      .values({ postId, userId: user.id })
      .onConflictDoNothing();
  }

  revalidatePath(back);
  revalidatePath("/");
}
