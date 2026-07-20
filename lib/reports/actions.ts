"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/db";
import { rateLimit } from "@/lib/rate-limit";

const KINDS = new Set(schema.reportTargetKind.enumValues);

/** İçerik şikayeti: listing / topic_post / post / user. Moderasyon kuyruğuna düşer. */
export async function reportContent(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris");

  const targetKind = String(formData.get("targetKind") ?? "");
  const targetId = String(formData.get("targetId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  const back = String(formData.get("back") ?? "/");
  if (!KINDS.has(targetKind as never) || !/^[0-9a-f-]{36}$/.test(targetId) || reason.length < 3)
    return;
  if (!(await rateLimit(`sikayet:${user.id}`, 10, 3600))) return;

  await db().insert(schema.reports).values({
    reporterId: user.id,
    targetKind: targetKind as (typeof schema.reportTargetKind.enumValues)[number],
    targetId,
    reason,
  });
  revalidatePath(back);
}
