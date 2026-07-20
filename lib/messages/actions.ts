"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/db";
import { findOrCreateDirect } from "./helpers";
import { rateLimit } from "@/lib/rate-limit";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris");
  return user;
}

/** Profil/isteyenler ekranından konuşma başlat (isteğe bağlı ilk mesajla). */
export async function startConversation(formData: FormData) {
  const otherId = String(formData.get("userId") ?? "");
  const text = String(formData.get("text") ?? "").trim().slice(0, 2000);
  if (!otherId) return;
  const user = await requireUser();
  if (otherId === user.id) return;
  if (!(await rateLimit(`msg:${user.id}`, 30, 300))) return;

  const convId = await findOrCreateDirect(user.id, otherId);
  if (text) {
    await db().insert(schema.messages).values({
      conversationId: convId,
      senderId: user.id,
      body: text,
      kind: "user",
    });
  }
  redirect(`/mesajlar?k=${convId}`);
}

export async function sendMessage(formData: FormData) {
  const convId = String(formData.get("conversationId") ?? "");
  const body = String(formData.get("body") ?? "").trim().slice(0, 2000);
  if (!convId || !body) return;
  const user = await requireUser();
  if (!(await rateLimit(`msg:${user.id}`, 30, 300))) return;

  // katılımcı mı?
  const member = await db()
    .select({ userId: schema.conversationParticipants.userId })
    .from(schema.conversationParticipants)
    .where(
      and(
        eq(schema.conversationParticipants.conversationId, convId),
        eq(schema.conversationParticipants.userId, user.id)
      )
    )
    .limit(1);
  if (member.length === 0) return;

  await db().insert(schema.messages).values({
    conversationId: convId,
    senderId: user.id,
    body,
    kind: "user",
  });
  await db()
    .update(schema.conversationParticipants)
    .set({ lastReadAt: new Date() })
    .where(
      and(
        eq(schema.conversationParticipants.conversationId, convId),
        eq(schema.conversationParticipants.userId, user.id)
      )
    );

  revalidatePath("/mesajlar");
}

