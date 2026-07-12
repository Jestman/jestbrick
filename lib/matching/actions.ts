"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/db";
import { findOrCreateDirect } from "@/lib/messages/helpers";
import { wishersOf } from "./queries";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris");
  return user;
}

export type BulkState = { error?: string; ok?: string } | undefined;

/**
 * Toplu "elimde var" mesajı. Spam koruması veritabanında:
 * match_broadcasts UNIQUE (sender_id, sent_on) → günde 1 toplu gönderim.
 */
export async function bulkMatchMessage(_prev: BulkState, formData: FormData): Promise<BulkState> {
  const setNum = String(formData.get("setNum") ?? "");
  if (!setNum) return;
  const user = await requireUser();

  // set gerçekten koleksiyonunda mı?
  const owned = await db()
    .select({ id: schema.collectionItems.id })
    .from(schema.collectionItems)
    .where(
      and(
        eq(schema.collectionItems.userId, user.id),
        eq(schema.collectionItems.setNum, setNum)
      )
    )
    .limit(1);
  if (owned.length === 0) {
    return { error: "Toplu mesaj için set koleksiyonunda olmalı." };
  }

  const targets = await wishersOf(setNum, user.id);
  if (targets.length === 0) return { error: "Bu seti isteyen ulaşılabilir üye yok." };

  // Günlük kota — UNIQUE ihlali yakalanır
  try {
    await db().insert(schema.matchBroadcasts).values({
      senderId: user.id,
      setNum,
      recipientCount: targets.length,
    });
  } catch {
    return { error: "Günlük toplu mesaj hakkını kullandın — yarın tekrar dene. (Tekil mesaj her zaman serbest.)" };
  }

  const [setRow] = await db()
    .select({ name: schema.sets.name, no: schema.sets.setNum })
    .from(schema.sets)
    .where(eq(schema.sets.setNum, setNum));

  for (const t of targets) {
    const convId = await findOrCreateDirect(user.id, t.userId);
    await db().insert(schema.messages).values({
      conversationId: convId,
      senderId: user.id,
      kind: "match_offer",
      body: `İstek listendeki ${setRow?.name ?? setNum} (#${setNum.replace(/-1$/, "")}) koleksiyonumda var. İlgilenirsen konuşalım! 🧱`,
    });
  }

  return { ok: `${targets.length} kişiye eşleştirme mesajı gönderildi 📨` };
}
