"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { db, schema } from "@/db";
import { notify } from "@/lib/notify";
import { rateLimit, RATE_MSG } from "@/lib/rate-limit";

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

/** FormData'daki fotoğrafları Storage'a yükler, topic_post_media satırları açar. */
async function attachPhotos(formData: FormData, topicPostId: string) {
  const files = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0 && f.type.startsWith("image/"))
    .slice(0, MAX_PHOTOS);
  if (files.length === 0) return;

  const admin = createAdminClient();
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (f.size > MAX_PHOTO_BYTES) continue;
    const ext = (f.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const path = `topics/${topicPostId}/${i}.${ext}`;
    const { error } = await admin.storage
      .from("media")
      .upload(path, Buffer.from(await f.arrayBuffer()), { contentType: f.type, upsert: true });
    if (!error) {
      await db()
        .insert(schema.topicPostMedia)
        .values({ topicPostId, storagePath: path, position: i });
    }
  }
}

export type TopicFormState = { error?: string } | undefined;

/** Yeni başlık: topic + ilk gönderi (fotoğraflı) tek adımda. */
export async function createTopic(
  _prev: TopicFormState,
  formData: FormData
): Promise<TopicFormState> {
  const user = await requireUser();
  if (!(await rateLimit(`konu:${user.id}`, 5, 3600))) return { error: RATE_MSG };

  const categoryId = Number(formData.get("categoryId"));
  const title = String(formData.get("title") ?? "").trim().slice(0, 140);
  const body = String(formData.get("body") ?? "").trim().slice(0, 10_000);

  if (!Number.isInteger(categoryId)) return { error: "Kategori seç." };
  if (title.length < 5) return { error: "Başlık en az 5 karakter olmalı." };
  if (body.length < 10) return { error: "İlk mesaj en az 10 karakter olmalı." };

  const [cat] = await db()
    .select({ id: schema.forumCategories.id })
    .from(schema.forumCategories)
    .where(eq(schema.forumCategories.id, categoryId));
  if (!cat) return { error: "Kategori bulunamadı." };

  const [topic] = await db()
    .insert(schema.topics)
    .values({ categoryId, authorId: user.id, title })
    .returning({ id: schema.topics.id });
  const [post] = await db()
    .insert(schema.topicPosts)
    .values({ topicId: topic.id, authorId: user.id, body })
    .returning({ id: schema.topicPosts.id });
  await attachPhotos(formData, post.id);

  redirect(`/forum/konu/${topic.id}`);
}

/** Başlığa yanıt (fotoğraflı); konu sahibine bildirim düşer. */
export async function replyTopic(formData: FormData) {
  const topicId = String(formData.get("topicId") ?? "");
  const body = String(formData.get("body") ?? "").trim().slice(0, 10_000);
  if (!topicId || body.length < 2) return;
  const user = await requireUser();
  if (!(await rateLimit(`yanit:${user.id}`, 20, 600))) return;

  const [topic] = await db()
    .select({
      authorId: schema.topics.authorId,
      locked: schema.topics.locked,
      title: schema.topics.title,
    })
    .from(schema.topics)
    .where(eq(schema.topics.id, topicId));
  if (!topic || topic.locked) return;

  const [post] = await db()
    .insert(schema.topicPosts)
    .values({ topicId, authorId: user.id, body })
    .returning({ id: schema.topicPosts.id });
  await attachPhotos(formData, post.id);
  await notify(topic.authorId, user.id, "reply", {
    topicId,
    title: topic.title.slice(0, 80),
  });

  revalidatePath(`/forum/konu/${topicId}`);
}
