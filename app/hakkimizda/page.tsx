export const metadata = {
  title: "Hakkımızda",
  description: "JestBrick nedir? Türkiye'nin LEGO koleksiyoncu topluluğunun hikayesi.",
};

export default function HakkimizdaPage() {
  return (
    <main className="wrap" style={{ maxWidth: 640 }}>
      <h1 className="page">Hakkımızda</h1>
      <div className="card" style={{ fontSize: 14.5, lineHeight: 1.7, display: "grid", gap: 14 }}>
        <p>
          <b>JestBrick</b>, Türkiye'deki LEGO® koleksiyoncularını tek çatı altında buluşturmak için
          kurulmuş bağımsız bir topluluk platformudur. Koleksiyonunu sergilersin, istek listeni
          paylaşırsın; seti olan ile arayanı biz buluştururuz.
        </p>
        <p>
          Burada 20 bine yakın setlik bir katalog, koleksiyoncudan koleksiyoncuya güvenli bir pazar,
          emeklilik takibi ve LEGO sohbetlerinin döndüğü bir forum var. Amacımız basit: tuğla
          sevgisini paylaşan insanları bir araya getirmek.
        </p>
        <p>
          JestBrick, LEGO içerik üreticisi <b>Jestman</b> tarafından hayata geçirilmiştir ve şu an{" "}
          <b>beta</b> aşamasındadır — görüşlerin bizim için değerli, aklına takılanı{" "}
          <a href="/iletisim">iletişim</a> sayfasından ulaştırabilirsin.
        </p>
        <p style={{ fontSize: 12.5, color: "var(--ink3)" }}>
          JestBrick bağımsız bir hayran platformudur; LEGO Group ile bağlantısı yoktur, LEGO Group
          tarafından desteklenmez ve onaylanmaz. LEGO® ve Minifigür, LEGO Group'un tescilli
          markalarıdır. Katalog verileri{" "}
          <a href="https://rebrickable.com" target="_blank" rel="noopener">Rebrickable</a> ve{" "}
          <a href="https://brickset.com" target="_blank" rel="noopener">Brickset</a> kaynaklıdır.
        </p>
      </div>
    </main>
  );
}
