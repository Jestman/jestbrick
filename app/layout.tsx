import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import "./globals.css";
import { getUser } from "@/lib/supabase/server";
import { envReady } from "@/db";
import { signOut } from "@/lib/auth/actions";

export const metadata: Metadata = {
  title: { default: "JestBrick — LEGO Koleksiyoncu Ağı", template: "%s · JestBrick" },
  description:
    "Koleksiyonunu sergile, istek listeni paylaş, seti olanla arayanı buluştur. LEGO koleksiyoncularının buluşma noktası.",
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
  return (
    <>
      <Link href="/koleksiyon">Koleksiyonum</Link>
      <Link href="/hesap/profil">Hesabım</Link>
      <form action={signOut} style={{ display: "inline" }}>
        <button className="btn btn-o" style={{ padding: "7px 14px", fontSize: 13 }}>
          Çıkış
        </button>
      </form>
    </>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <header className="topbar">
          <Brand />
          <nav>
            <Link href="/setler">Setler</Link>
            <Link href="/uyeler">Üyeler</Link>
            <Suspense fallback={null}>
              <AuthNav />
            </Suspense>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
