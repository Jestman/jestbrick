"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { db, schema } from "@/db";

const MAX_PHOTOS = 4;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

/** Aktörün kimliğiyle bildirim düşürür (kendine bildirim üretmez). */
async function notify(
  targetUserId: string,
  actorId: string,
  type: "follow" | "like" | "comment",
  extra: Record<string, unknown> = {}
) {
  if (targetUserId === actorId) return;
  const [actor] = await db()
    .select({ handle: schema.users.handle, name: schema.users.displayName })
    .from(schema.users)
    .where(eq(schema.users.id, actorId));
  await db().insert(schema.notifications).values({
    userId: targetUserId,
    type,
    payload: { actorId, actorHandle: actor?.handle, actorName: actor?.name, ...extra },
  });
}

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

  const inserted = await db()
    .insert(schema.follows)
    .values({ followerId: user.id, followeeId })
    .onConflictDoNothing()
    .returning({ f: schema.follows.followerId });
  if (inserted.length > 0) await notify(followeeId, user.id, "follow");

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

export async function addComment(formData: FormData) {
  const postId = String(formData.get("postId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!postId || !body || body.length > 1000) return;
  const user = await requireUser();

  await db().insert(schema.comments).values({ postId, authorId: user.id, body });
  const [post] = await db()
    .select({ authorId: schema.posts.authorId })
    .from(schema.posts)
    .where(eq(schema.posts.id, postId));
  if (post) await notify(post.authorId, user.id, "comment", { postId, excerpt: body.slice(0, 80) });
  revalidatePath("/");
}

/** Fotoğraflı / metinli paylaşım oluşturur; görseller Storage'a yüklenir. */
export async function createPost(formData: FormData) {
  const user = await requireUser();
  const body = String(formData.get("body") ?? "").trim().slice(0, 2000);
  const files = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0 && f.type.startsWith("image/"))
    .slice(0, MAX_PHOTOS);

  if (!body && files.length === 0) return;
  if (files.some((f) => f.size > MAX_PHOTO_BYTES)) return;

  const [post] = await db()
    .insert(schema.posts)
    .values({ authorId: user.id, kind: "photo", body })
    .returning({ id: schema.posts.id });

  if (files.length > 0) {
    const admin = createAdminClient();
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const ext = (f.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
      const path = `posts/${post.id}/${i}.${ext}`;
      const { error } = await admin.storage
        .from("media")
        .upload(path, Buffer.from(await f.arrayBuffer()), {
          contentType: f.type,
          upsert: true,
        });
      if (!error) {
        await db()
          .insert(schema.postMedia)
          .values({ postId: post.id, storagePath: path, position: i });
      }
    }
  }

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
    const [post] = await db()
      .select({ authorId: schema.posts.authorId })
      .from(schema.posts)
      .where(eq(schema.posts.id, postId));
    if (post) await notify(post.authorId, user.id, "like", { postId });
  }

  revalidatePath(back);
  revalidatePath("/");
}
