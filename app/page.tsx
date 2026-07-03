import Link from "next/link";
import { envReady } from "@/db";

export default function Home() {
  return (
    <main className="wrap" style={{ maxWidth: 720 }}>
      <div style={{ padding: "48px 0 32px" }}>
        <h1
          style={{
            fontFamily: "var(--disp)",
            fontSize: "clamp(28px, 5vw, 40px)",
            fontWeight: 800,
            letterSpacing: "-0.8px",
            lineHeight: 1.15,
            textWrap: "balance",
          }}
        >
          Koleksiyonunu sergile.
          <br />
          Seti olanla arayanı buluştur.
        </h1>
        <p style={{ color: "var(--ink2)", marginTop: 14, maxWidth: "52ch", fontSize: 16 }}>
          JestBrick, LEGO koleksiyoncularının buluşma noktası: koleksiyon vitrini, istek listesi
          eşleştirme, forum ve güvenli ikinci el pazarı — hepsi tek yerde.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 26, flexWrap: "wrap" }}>
          <Link href="/kayit" className="btn btn-y">
            🧱 Aramıza Katıl
          </Link>
          <Link href="/setler" className="btn btn-o">
            Set Kataloğuna Göz At
          </Link>
        </div>
      </div>

      {!envReady() && (
        <div className="notice">
          <b>Kurulum bekleniyor:</b> <code>.env.local</code> dosyası eksik. <code>README.md</code>
          &nbsp;içindeki adımları izleyerek Supabase projeni bağla; ardından bu uyarı kaybolur.
        </div>
      )}

      <div className="card" style={{ marginTop: 24 }}>
        <b style={{ fontFamily: "var(--disp)" }}>Faz 0 durumu</b>
        <ul style={{ margin: "10px 0 0 20px", color: "var(--ink2)", fontSize: 14 }}>
          <li>✅ Kayıt / giriş ve kullanıcı adı seçimi</li>
          <li>✅ Set kataloğu: arama ve detay sayfaları</li>
          <li>✅ Profil iskeleti (/u/kullaniciadi)</li>
          <li>⏳ Koleksiyon ve istek listesi — Faz 1</li>
        </ul>
      </div>
    </main>
  );
}
