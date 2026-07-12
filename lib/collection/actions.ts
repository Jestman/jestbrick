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
