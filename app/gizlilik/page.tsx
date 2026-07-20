export const metadata = {
  title: "Gizlilik Politikası (KVKK)",
  description: "JestBrick'in kişisel veri işleme, saklama ve çerez politikası.",
};

function H({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontFamily: "var(--disp)", fontSize: 16.5, fontWeight: 800, marginTop: 10 }}>
      {children}
    </h2>
  );
}

export default function GizlilikPage() {
  return (
    <main className="wrap" style={{ maxWidth: 680 }}>
      <h1 className="page">Gizlilik Politikası</h1>
      <div className="card" style={{ fontSize: 14, lineHeight: 1.7, display: "grid", gap: 12 }}>
        <p style={{ fontSize: 12.5, color: "var(--ink3)" }}>
          Son güncelleme: 20 Temmuz 2026 · Beta sürümü.
        </p>

        <H>Veri sorumlusu</H>
        <p>
          JestBrick, içerik üreticisi <b>Jestman</b> tarafından işletilen bağımsız bir topluluk
          platformudur. 6698 sayılı KVKK kapsamındaki başvurularını{" "}
          <a href="/iletisim">iletişim</a> sayfasındaki kanallardan iletebilirsin.
        </p>

        <H>Hangi verileri topluyoruz?</H>
        <ul style={{ paddingLeft: 22, display: "grid", gap: 6 }}>
          <li><b>Hesap:</b> e-posta, şifre (şifrelenmiş), kullanıcı adı, görünen ad.</li>
          <li><b>Profil (isteğe bağlı):</b> fotoğraf, şehir, hakkında yazısı.</li>
          <li><b>İçerik:</b> koleksiyon/istek listen, ilanların, forum mesajların, özel mesajların ve yüklediğin fotoğraflar.</li>
          <li><b>Teknik:</b> çerezsiz, anonim kullanım istatistikleri (sayfa görüntüleme, ülke, cihaz türü — kişiyle eşleştirilmez).</li>
        </ul>

        <H>Ne için kullanıyoruz?</H>
        <p>
          Yalnızca platformun çalışması için: hesabına giriş, eşleştirme bildirimleri, mesajlaşma
          ve vitrin özellikleri. Verilerini üçüncü taraflara satmayız, pazarlama amaçlı
          paylaşmayız.
        </p>

        <H>Çerezler</H>
        <p>
          Yalnızca oturumunu açık tutmaya yarayan zorunlu çerezler kullanılır. Reklam ya da takip
          çerezi yoktur; ziyaret istatistikleri çerezsiz ve anonim toplanır.
        </p>

        <H>Görünürlük kontrolleri</H>
        <p>
          Profilinin üye olmayanlara görünürlüğünü, istek listenin görünürlüğünü ve tekil setlerin
          gizliliğini ayarlardan yönetebilirsin. Özel mesajların yalnızca konuşmanın taraflarınca
          görülebilir.
        </p>

        <H>Saklama ve altyapı</H>
        <p>
          Veriler, erişim kontrolü (satır düzeyi güvenlik) uygulanan <b>Supabase</b> altyapısında
          (AB bölgesi — Frankfurt) saklanır; site <b>Vercel</b> üzerinde barındırılır. Bu
          sağlayıcılar veriyi yalnızca platformun çalışması için işler. Hesabını sildirmek
          istediğinde tüm kişisel verilerin ve içeriklerin kalıcı olarak silinir.
        </p>

        <H>KVKK hakların</H>
        <p>
          6698 sayılı KVKK kapsamında verilerine erişme, düzeltme, silme ve işlemeye itiraz etme
          hakkına sahipsin. Başvurular için <a href="/iletisim">iletişim</a> sayfasındaki
          kanalları kullanabilirsin.
        </p>
      </div>
    </main>
  );
}
