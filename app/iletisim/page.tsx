export const metadata = {
  title: "İletişim",
  description: "JestBrick ekibine ulaş: öneri, hata bildirimi ve işbirlikleri.",
};

export default function IletisimPage() {
  return (
    <main className="wrap" style={{ maxWidth: 680 }}>
      <h1 className="page">İletişim</h1>
      <div className="card" style={{ fontSize: 14.5, lineHeight: 1.7, display: "grid", gap: 14 }}>
        <p>
          Öneri, hata bildirimi, işbirliği ya da sadece merhaba demek için bize şuralardan
          ulaşabilirsin:
        </p>
        <ul style={{ paddingLeft: 22, display: "grid", gap: 8 }}>
          <li>
            📸 Instagram:{" "}
            <a href="https://instagram.com/jestman" target="_blank" rel="noopener">
              @jestman
            </a>
          </li>
          <li>
            💬 Forum:{" "}
            <a href="/forum?k=genel">Genel Sohbet</a> kategorisine yazabilirsin — beta sürecinde
            geri bildirim başlıkları bizzat okunuyor.
          </li>
          <li>
            🚩 İçerik şikayeti: ilanların ve forum mesajlarının altındaki <b>şikayet</b> bağlantısı
            doğrudan moderasyon kuyruğuna düşer.
          </li>
        </ul>
        <p style={{ fontSize: 13, color: "var(--ink3)" }}>
          Yasal bildirimler ve KVKK başvuruları için şimdilik Instagram DM kanalını
          kullanabilirsin; e-posta adresimiz yakında burada olacak.
        </p>
      </div>
    </main>
  );
}
