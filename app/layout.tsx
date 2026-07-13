import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { and, count, eq, isNull } from "drizzle-orm";
import "./globals.css";
import { getUser } from "@/lib/supabase/server";
import { db, envReady, schema } from "@/db";
import { signOut } from "@/lib/auth/actions";
import { unreadConversationCount } from "@/lib/messages/helpers";
import { currentRole, isModerator } from "@/lib/admin/guards";
import { getFlags } from "@/lib/settings";
import { Analytics } from "@vercel/analytics/next";
import { desc } from "drizzle-orm";
import { Avatar } from "./components/Avatar";
import { mediaUrl } from "@/lib/media";
import { timeAgo } from "@/lib/format";
import { NavShell } from "./components/NavShell";

export const metadata: Metadata = {
  metadataBase: new URL("https://jestbrick.com"),
  title: { default: "JestBrick — LEGO Koleksiyoncu Ağı", template: "%s · JestBrick" },
  description:
    "Koleksiyonunu sergile, istek listeni paylaş, seti olanla arayanı buluştur. LEGO koleksiyoncularının buluşma noktası.",
  openGraph: { siteName: "JestBrick", locale: "tr_TR", type: "website" },
  robots: { index: true, follow: true },
};

function Brand() {
  return (
    <Link href="/" className="logo">
      <svg width="30" height="22" viewBox="0 0 30 22" aria-hidden>
        <rect x="1" y="7" width="28" height="14" rx="3" fill="#F5C518" />
        <rect x="5" y="2" width="8" height="7" rx="2" fill="#F5C518" />
        <rect x="17" y="2" width="8" height="7" rx="2" fill="#F5C518" />
        <rect x="1" y="7" width="28" height="14" rx="3" fill="none" stroke="#20232E" strokeWidth="1.6" />
        <rect x="5" y="2" width="8" height="7" rx="2" fill="none" stroke="#20232E" strokeWidth="1.6" />
        <rect x="17" y="2" width="8" height="7" rx="2" fill="none" stroke="#20232E" strokeWidth="1.6" />
      </svg>
      Jest<b>Brick</b>
    </Link>
  );
}

function NavBadge({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span
      style={{
        background: "var(--red)", color: "#fff", fontSize: 10, fontWeight: 800,
        minWidth: 16, height: 16, borderRadius: 8, display: "inline-flex",
        alignItems: "center", justifyContent: "center", padding: "0 4px",
        marginLeft: 4, verticalAlign: "2px",
      }}
    >
      {n > 9 ? "9+" : n}
    </span>
  );
}

const NOTIF_TEXT: Record<string, string> = {
  follow: "seni takip etmeye başladı",
  like: "paylaşımını beğendi",
  comment: "paylaşımına yorum yaptı",
  wishlist_listing: "istek listendeki set için ilan açtı",
  listing_interest: "ilanınla ilgileniyor",
  demand_on_owned: "koleksiyonundaki bir seti arıyor",
  reply: "başlığına yanıt yazdı",
};
const NOTIF_ICON: Record<string, string> = {
  follow: "👤", like: "❤️", comment: "💬",
  wishlist_listing: "🏷️", listing_interest: "🙋", demand_on_owned: "🔥", reply: "↩️",
};

/** Zil: son 5 bildirimi açılır panelde gösterir (tamamı /bildirimler'de). */
async function NotifBell({ userId, unread }: { userId: string; unread: number }) {
  const items = await db()
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, userId))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(5);

  return (
    <details className="dd">
      <summary title="Bildirimler" aria-label="Bildirimler">
        🔔<span className="nav-label"> Bildirimler</span>
        <NavBadge n={unread} />
      </summary>
      <div className="dd-panel">
        {items.length === 0 ? (
          <p style={{ padding: "12px 14px", fontSize: 13, color: "var(--ink3)" }}>Henüz bildirimin yok.</p>
        ) : (
          items.map((n) => {
            const p = (n.payload ?? {}) as Record<string, string>;
            return (
              <Link
                key={n.id}
                href={p.listingId ? `/pazar/${p.listingId}` : p.topicId ? `/forum/konu/${p.topicId}` : "/bildirimler"}
                className="dd-row"
                style={{ fontWeight: n.readAt ? 400 : 700 }}
              >
                <span style={{ flex: "none" }}>{NOTIF_ICON[n.type] ?? "🔔"}</span>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.actorName || p.actorHandle || "JestBrick"} {NOTIF_TEXT[n.type] ?? ""}
                </span>
                <small style={{ color: "var(--ink3)", flex: "none" }}>{timeAgo(n.createdAt)}</small>
              </Link>
            );
          })
        )}
        <Link href="/bildirimler" className="dd-row" style={{ justifyContent: "center", fontWeight: 700, fontSize: 13 }}>
          Tümünü gör →
        </Link>
      </div>
    </details>
  );
}

async function AuthNav() {
  if (!envReady()) return null;
  const user = await getUser();
  if (!user) {
    return (
      <>
        <Link href="/giris">Giriş</Link>
        <Link href="/kayit" className="btn btn-y" style={{ padding: "8px 16px" }}>
          Katıl
        </Link>
      </>
    );
  }

  const [unreadMsgs, [{ unreadNotifs }], me, [meRow]] = await Promise.all([
    unreadConversationCount(user.id),
    db()
      .select({ unreadNotifs: count() })
      .from(schema.notifications)
      .where(and(eq(schema.notifications.userId, user.id), isNull(schema.notifications.readAt))),
    currentRole(),
    db()
      .select({ handle: schema.users.handle, name: schema.users.displayName, avatar: schema.users.avatarPath })
      .from(schema.users)
      .where(eq(schema.users.id, user.id))
      .limit(1),
  ]);

  return (
    <>
      <Link href="/koleksiyon">Koleksiyonum</Link>
      {me && isModerator(me.role) && <Link href="/yonetim">🛡️ Yönetim</Link>}
      <Link href="/mesajlar">
        Mesajlar
        <NavBadge n={unreadMsgs} />
      </Link>
      <NotifBell userId={user.id} unread={unreadNotifs} />
      <details className="dd">
        <summary title="Hesap menüsü" aria-label="Hesap menüsü" style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          <Avatar handle={meRow?.handle ?? "ben"} name={meRow?.name ?? ""} size={28} src={mediaUrl(meRow?.avatar ?? null)} />
          <span className="nav-label">{meRow?.name || meRow?.handle}</span>
          <span aria-hidden style={{ fontSize: 10, color: "var(--ink3)" }}>▾</span>
        </summary>
        <div className="dd-panel" style={{ minWidth: 200 }}>
          <Link href={`/u/${meRow?.handle}`} className="dd-row">👤 Profilim</Link>
          <Link href="/pazar/ilanlarim" className="dd-row">🏷️ İlanlarım</Link>
          <Link href="/hesap/profil" className="dd-row">⚙️ Hesap Ayarları</Link>
          <form action={signOut} style={{ display: "block", borderTop: "1px solid var(--line)" }}>
            <button className="dd-row" style={{ width: "100%", background: "none", border: "none", textAlign: "left", fontSize: 14 }}>
              🚪 Çıkış
            </button>
          </form>
        </div>
      </details>
    </>
  );
}

async function SectionNav() {
  if (!envReady()) {
    return (
      <>
        <Link href="/setler">Setler</Link>
        <Link href="/talepler">Talepler</Link>
        <Link href="/uyeler">Üyeler</Link>
      </>
    );
  }
  const flags = await getFlags();
  return (
    <>
      <Link href="/setler">Setler</Link>
      {flags.market_enabled && <Link href="/pazar">Pazar</Link>}
      <Link href="/talepler">Talepler</Link>
      {flags.forum_enabled && <Link href="/forum">Forum</Link>}
      <Link href="/uyeler">Üyeler</Link>
    </>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <header className="topbar">
          <Brand />
          <form action="/setler" className="nav-search" role="search">
            <input name="q" placeholder="🔍 Set ara…" autoComplete="off" aria-label="Set ara" />
          </form>
          <NavShell>
            <form action="/setler" className="nav-search-m" role="search">
              <input name="q" placeholder="🔍 Set ara…" autoComplete="off" aria-label="Set ara" />
            </form>
            <Suspense fallback={null}>
              <SectionNav />
            </Suspense>
            <Suspense fallback={null}>
              <AuthNav />
            </Suspense>
          </NavShell>
        </header>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
