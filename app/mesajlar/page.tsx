import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db, envReady, schema } from "@/db";
import { getUser } from "@/lib/supabase/server";
import { sendMessage } from "@/lib/messages/actions";
import { Avatar } from "@/app/components/Avatar";
import { PendingButton } from "@/app/components/PendingButton";
import { mediaUrl } from "@/lib/media";
import { timeAgo } from "@/lib/format";
import { LiveRefresh } from "./LiveRefresh";

export const metadata = { title: "Mesajlar" };

export default async function MesajlarPage({
  searchParams,
}: {
  searchParams: Promise<{ k?: string }>;
}) {
  if (!envReady()) redirect("/");
  const user = await getUser();
  if (!user) redirect("/giris?sonra=/mesajlar");
  const { k } = await searchParams;

  // Konuşmalarım + karşı taraf + son mesaj
  const myConvs = await db()
    .select({
      convId: schema.conversationParticipants.conversationId,
      lastReadAt: schema.conversationParticipants.lastReadAt,
    })
    .from(schema.conversationParticipants)
    .where(eq(schema.conversationParticipants.userId, user.id));
  const convIds = myConvs.map((c) => c.convId);

  type ConvInfo = {
    convId: string;
    otherHandle: string;
    otherName: string;
    otherAvatar: string | null;
    lastBody: string | null;
    lastAt: Date | null;
    unread: boolean;
  };
  let convs: ConvInfo[] = [];
  if (convIds.length > 0) {
    const others = await db()
      .select({
        convId: schema.conversationParticipants.conversationId,
        handle: schema.users.handle,
        name: schema.users.displayName,
        avatar: schema.users.avatarPath,
      })
      .from(schema.conversationParticipants)
      .innerJoin(schema.users, eq(schema.conversationParticipants.userId, schema.users.id))
      .where(
        and(
          inArray(schema.conversationParticipants.conversationId, convIds),
          ne(schema.conversationParticipants.userId, user.id)
        )
      );
    const lastMsgs = await db()
      .select({
        convId: schema.messages.conversationId,
        body: sql<string>`(array_agg(${schema.messages.body} order by ${schema.messages.createdAt} desc))[1]`,
        lastAt: sql<Date>`max(${schema.messages.createdAt})`,
        lastOtherAt: sql<Date | null>`max(${schema.messages.createdAt})
          filter (where ${schema.messages.senderId} <> ${user.id})`,
      })
      .from(schema.messages)
      .where(inArray(schema.messages.conversationId, convIds))
      .groupBy(schema.messages.conversationId);

    const lastMap = new Map(lastMsgs.map((m) => [m.convId, m]));
    const readMap = new Map(myConvs.map((c) => [c.convId, c.lastReadAt]));
    convs = others
      .map((o) => {
        const last = lastMap.get(o.convId);
        const lastRead = readMap.get(o.convId);
        const lastOther = last?.lastOtherAt ? new Date(last.lastOtherAt) : null;
        return {
          convId: o.convId,
          otherHandle: o.handle,
          otherName: o.name,
          otherAvatar: mediaUrl(o.avatar),
          lastBody: last?.body ?? null,
          lastAt: last?.lastAt ? new Date(last.lastAt) : null,
          unread: Boolean(lastOther && (!lastRead || lastOther > lastRead)),
        };
      })
      .sort((a, b) => (b.lastAt?.getTime() ?? 0) - (a.lastAt?.getTime() ?? 0));
  }

  // Otomatik seçim yok: mobilde tek panel gösterildiğinden k'sız giriş liste ekranıdır.
  const activeId = k && convIds.includes(k) ? k : null;
  const active = convs.find((c) => c.convId === activeId) ?? null;

  let msgs: { id: string; senderId: string; body: string; kind: string; createdAt: Date }[] = [];
  if (activeId) {
    msgs = await db()
      .select({
        id: schema.messages.id,
        senderId: schema.messages.senderId,
        body: schema.messages.body,
        kind: schema.messages.kind,
        createdAt: schema.messages.createdAt,
      })
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, activeId))
      .orderBy(asc(schema.messages.createdAt))
      .limit(200);

    // görüntülenen konuşmayı okundu say (dinamik sayfa; render'da hafif bir güncelleme kabul edilebilir)
    if (active?.unread) {
      await db()
        .update(schema.conversationParticipants)
        .set({ lastReadAt: new Date() })
        .where(
          and(
            eq(schema.conversationParticipants.conversationId, activeId),
            eq(schema.conversationParticipants.userId, user.id)
          )
        );
    }
  }

  return (
    <main className="wrap" style={{ maxWidth: 900 }}>
      <h1 className="page">Mesajlar</h1>
      {convs.length === 0 ? (
        <div className="notice">
          Henüz mesajın yok. Bir üyenin profilinden ya da set sayfasındaki{" "}
          <b>“isteyenler”</b> listesinden konuşma başlatabilirsin.
        </div>
      ) : (
        <div
          className="card chat-grid"
          data-open={active ? "true" : "false"}
          style={{ padding: 0, display: "grid", gridTemplateColumns: "280px 1fr", overflow: "hidden", minHeight: 460 }}
        >
          <div className="chat-list" style={{ borderRight: "1px solid var(--line)", overflowY: "auto" }}>
            {convs.map((c) => (
              <Link
                key={c.convId}
                href={`/mesajlar?k=${c.convId}`}
                style={{
                  display: "flex", gap: 11, padding: "13px 15px", alignItems: "center",
                  borderBottom: "1px solid var(--line)", color: "inherit", textDecoration: "none",
                  background: c.convId === activeId ? "var(--yellow-soft)" : undefined,
                }}
              >
                <Avatar handle={c.otherHandle} name={c.otherName} size={42} src={c.otherAvatar} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                    {c.otherName || c.otherHandle}
                    {c.unread && (
                      <span style={{ width: 8, height: 8, borderRadius: 4, background: "var(--red)", flex: "none" }} />
                    )}
                  </b>
                  <div style={{
                    fontSize: 12.5, color: "var(--ink3)", whiteSpace: "nowrap",
                    overflow: "hidden", textOverflow: "ellipsis", maxWidth: 180,
                  }}>
                    {c.lastBody ?? "…"}
                  </div>
                </div>
                {c.lastAt && (
                  <span style={{ fontSize: 11, color: "var(--ink3)", flex: "none" }}>{timeAgo(c.lastAt)}</span>
                )}
              </Link>
            ))}
          </div>

          <div className="chat-pane" style={{ display: "flex", flexDirection: "column" }}>
            {active ? (
              <>
                <LiveRefresh conversationId={active.convId} />
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 17px", borderBottom: "1px solid var(--line)", fontWeight: 700 }}>
                  <Link href="/mesajlar" className="chat-back" aria-label="Konuşma listesine dön" style={{ fontSize: 18, color: "var(--ink2)", alignItems: "center" }}>
                    ←
                  </Link>
                  <Avatar handle={active.otherHandle} name={active.otherName} size={34} src={active.otherAvatar} />
                  <Link href={`/u/${active.otherHandle}`} style={{ color: "inherit" }}>
                    {active.otherName || active.otherHandle}
                  </Link>
                  <span style={{ fontSize: 12.5, color: "var(--ink3)", fontWeight: 500 }}>@{active.otherHandle}</span>
                </div>
                <div style={{ flex: 1, padding: 17, display: "flex", flexDirection: "column", gap: 9, overflowY: "auto", maxHeight: 420 }}>
                  {msgs.map((m) => {
                    const mine = m.senderId === user.id;
                    return (
                      <div
                        key={m.id}
                        style={{
                          maxWidth: "75%",
                          padding: "9px 14px",
                          borderRadius: 15,
                          fontSize: 14,
                          alignSelf: mine ? "flex-end" : "flex-start",
                          background: m.kind === "match_offer" ? "var(--yellow-soft)" : mine ? "var(--yellow)" : "var(--soft)",
                          border: m.kind === "match_offer" ? "1px dashed var(--yellow-d)" : undefined,
                          borderBottomRightRadius: mine ? 5 : 15,
                          borderBottomLeftRadius: mine ? 15 : 5,
                        }}
                      >
                        {m.kind === "match_offer" && (
                          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.5, color: "var(--ink2)", textTransform: "uppercase", marginBottom: 3 }}>
                            🧱 Eşleştirme Teklifi
                          </div>
                        )}
                        {m.body}
                        <div style={{ fontSize: 10.5, color: "var(--ink3)", marginTop: 3 }}>{timeAgo(m.createdAt)}</div>
                      </div>
                    );
                  })}
                </div>
                <form action={sendMessage} style={{ display: "flex", gap: 9, padding: "13px 15px", borderTop: "1px solid var(--line)" }}>
                  <input type="hidden" name="conversationId" value={active.convId} />
                  <input
                    name="body"
                    placeholder="Mesaj yaz…"
                    maxLength={2000}
                    autoComplete="off"
                    style={{ flex: 1, background: "var(--soft)", border: "1px solid var(--line)", borderRadius: 99, padding: "10px 16px", outline: "none" }}
                  />
                  <PendingButton pendingText="…">Gönder</PendingButton>
                </form>
              </>
            ) : (
              <div className="empty" style={{ margin: "auto", color: "var(--ink3)" }}>Bir konuşma seç</div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
