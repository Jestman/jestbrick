import "server-only";
import { and, eq, sql } from "drizzle-orm";
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

/** Nav rozeti: okunmamış mesajı olan konuşma sayısı (tek sorgu). */
export async function unreadConversationCount(userId: string): Promise<number> {
  const [row] = await db().execute<{ n: number }>(sql`
    select count(*)::int as n
    from conversation_participants cp
    where cp.user_id = ${userId}
      and exists (
        select 1 from messages m
        where m.conversation_id = cp.conversation_id
          and m.sender_id <> ${userId}
          and (cp.last_read_at is null or m.created_at > cp.last_read_at)
      )
  `);
  return row?.n ?? 0;
}
