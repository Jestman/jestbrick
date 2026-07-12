import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";

/**
 * İki kullanıcı arasındaki direct konuşmayı bulur; yoksa oluşturur.
 * NOT: "use server" dosyasına koyma — action olarak dışa açılmamalı
 * (meId parametresi istemciden gelmemeli).
 */
export async function findOrCreateDirect(meId: string, otherId: string): Promise<string> {
  const existing = await db()
    .select({ id: schema.conversations.id })
    .from(schema.conversations)
    .where(
      and(
        eq(schema.conversations.kind, "direct"),
        sql`exists (select 1 from conversation_participants p1
             where p1.conversation_id = ${schema.conversations.id} and p1.user_id = ${meId})`,
        sql`exists (select 1 from conversation_participants p2
             where p2.conversation_id = ${schema.conversations.id} and p2.user_id = ${otherId})`
      )
    )
    .limit(1);
  if (existing.length > 0) return existing[0].id;

  const [conv] = await db()
    .insert(schema.conversations)
    .values({ kind: "direct" })
    .returning({ id: schema.conversations.id });
  await db().insert(schema.conversationParticipants).values([
    { conversationId: conv.id, userId: meId, lastReadAt: new Date() },
    { conversationId: conv.id, userId: otherId },
  ]);
  return conv.id;
}

/** Nav rozeti: okunmamış mesajı olan konuşma sayısı. */
export async function unreadConversationCount(userId: string): Promise<number> {
  const parts = await db()
    .select({
      conversationId: schema.conversationParticipants.conversationId,
      lastReadAt: schema.conversationParticipants.lastReadAt,
    })
    .from(schema.conversationParticipants)
    .where(eq(schema.conversationParticipants.userId, userId));
  if (parts.length === 0) return 0;

  const convIds = parts.map((p) => p.conversationId);
  const rows = await db()
    .select({
      conversationId: schema.messages.conversationId,
      lastOtherMsgAt: sql<string | null>`max(${schema.messages.createdAt})
        filter (where ${schema.messages.senderId} <> ${userId})`,
    })
    .from(schema.messages)
    .where(inArray(schema.messages.conversationId, convIds))
    .groupBy(schema.messages.conversationId);

  const readMap = new Map(parts.map((p) => [p.conversationId, p.lastReadAt]));
  let unread = 0;
  for (const r of rows) {
    if (!r.lastOtherMsgAt) continue;
    const lastRead = readMap.get(r.conversationId);
    if (!lastRead || new Date(r.lastOtherMsgAt) > lastRead) unread++;
  }
  return unread;
}
