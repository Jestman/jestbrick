"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/db";
import { notify } from "@/lib/notify";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris");
  return user;
}

export type TopicFormState = { error?: string } | undefined;

/** Yeni başlık: topic + ilk gönderi tek adımda. */
export async function createTopic(
  _prev: TopicFormState,
  formData: FormData
): Promise<TopicFormState> {
  const user = await requireUser();

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
  await db().insert(schema.topicPosts).values({ topicId: topic.id, authorId: user.id, body });

  redirect(`/forum/konu/${topic.id}`);
}

/** Başlığa yanıt; konu sahibine bildirim düşer. */
export async function replyTopic(formData: FormData) {
  const topicId = String(formData.get("topicId") ?? "");
  const body = String(formData.get("body") ?? "").trim().slice(0, 10_000);
  if (!topicId || body.length < 2) return;
  const user = await requireUser();

  const [topic] = await db()
    .select({
      authorId: schema.topics.authorId,
      locked: schema.topics.locked,
      title: schema.topics.title,
    })
    .from(schema.topics)
    .where(eq(schema.topics.id, topicId));
  if (!topic || topic.locked) return;

  await db().insert(schema.topicPosts).values({ topicId, authorId: user.id, body });
  await notify(topic.authorId, user.id, "reply", {
    topicId,
    title: topic.title.slice(0, 80),
  });

  revalidatePath(`/forum/konu/${topicId}`);
}
