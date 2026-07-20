export const metadata = {
  title: "Kurallar ve Kullanım Şartları",
  description: "JestBrick topluluk kuralları, pazar ilkeleri ve kullanım şartları.",
};

function H({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontFamily: "var(--disp)", fontSize: 16.5, fontWeight: 800, marginTop: 10 }}>
      {children}
    </h2>
  );
}

export default function KurallarPage() {
  return (
    <main className="wrap" style={{ maxWidth: 680 }}>
      <h1 className="page">Kurallar &amp; Kullanım Şartları</h1>
      <div className="card" style={{ fontSize: 14, lineHeight: 1.7, display: "grid", gap: 12 }}>
        <p style={{ fontSize: 12.5, color: "var(--ink3)" }}>
          Son güncelleme: 20 Temmuz 2026 · Beta sürümü.
        </p>

        <H>1. Genel</H>
        <p>
          JestBrick'e üye olarak bu şartları kabul etmiş sayılırsın. Platform 13 yaş ve üzeri
          kullanıcılar içindir. Hesabının güvenliğinden (şifre dahil) sen sorumlusun.
        </p>

        <H>2. Topluluk kuralları</H>
        <ul style={{ paddingLeft: 22, display: "grid", gap: 6 }}>
          <li>Saygı esastır: hakaret, nefret söylemi, taciz ve kişisel veri ifşası yasaktır.</li>
          <li>Spam, yanıltıcı içerik ve izinsiz reklam yasaktır.</li>
          <li>Paylaştığın fotoğraf ve metinlerin haklarına sahip olmalısın.</li>
          <li>Kural ihlalleri moderasyon tarafından içerik silme, kısıtlama ya da hesap kapatma ile sonuçlanabilir.</li>
          <li>Moderasyon kararlarına <a href="/iletisim">iletişim</a> sayfasındaki kanallardan itiraz edebilirsin.</li>
        </ul>

        <H>3. Pazar ilkeleri</H>
        <ul style={{ paddingLeft: 22, display: "grid", gap: 6 }}>
          <li>
            <b>JestBrick bir aracı değildir:</b> alışveriş, ödeme ve kargo tamamen alıcı ile satıcı
            arasındadır. Platform ödeme almaz, emanet (escrow) hizmeti sunmaz ve işlemlerden
            sorumlu tutulamaz.
          </li>
          <li>Pazar'da ilan verebilmek ve alışveriş yapabilmek için 18 yaşından büyük olmalısın (ya da işlemi bir velin yürütmelidir).</li>
          <li>İlanlar gerçek, elinde mevcut ürünler için verilmelidir; sahte/kaçak ürün satışı yasaktır.</li>
          <li>Satıcı puanları gerçek deneyime dayanmalıdır; puan manipülasyonu hesap kapatma sebebidir.</li>
          <li>Güvenli alışveriş için: buluşarak teslimatı tercih et, kargoda ödeme öncesi görüntülü doğrulama iste, satıcı puanlarını incele.</li>
        </ul>

        <H>4. İçerik ve fikri haklar</H>
        <p>
          Yüklediğin içerik sana aittir; JestBrick'e yalnızca platformda gösterim amaçlı kullanım
          izni verirsin. LEGO® ve Minifigür, LEGO Group'un tescilli markalarıdır; JestBrick
          bağımsız bir hayran platformudur ve LEGO Group ile bağlantısı yoktur. Katalog verileri
          Rebrickable ve Brickset kaynaklıdır.
        </p>

        <H>5. Sorumluluk reddi</H>
        <p>
          Platform "olduğu gibi" sunulur; kesintisiz ya da hatasız çalışacağı garanti edilmez.
          Emeklilik tarihleri ve fiyat bilgileri bilgilendirme amaçlıdır, yatırım tavsiyesi
          değildir.
        </p>
      </div>
    </main>
  );
}
