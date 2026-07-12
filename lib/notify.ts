import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

type NotifType = (typeof schema.notificationType.enumValues)[number];

/**
 * Aktörün kimliğiyle bildirim düşürür (kendine bildirim üretmez).
 * NOT: "use server" dosyasına koyma — action olarak dışa açılmamalı.
 */
export async function notify(
  targetUserId: string,
  actorId: string,
  type: NotifType,
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
