# JestBrick İş Listesi

Mimari dokümanı: https://claude.ai/code/artifact/64829469-3e7b-4d1a-bbe6-95149c9b8799
Durum işaretleri: ✅ bitti · 🔨 sırada · ⬜ planlı

## Faz 1 — Sosyal çekirdek
- ✅ Auth (kayıt/giriş/kullanıcı adı) + profil vitrini
- ✅ Katalog (19.879 set, 494 tema) + arama + set detay
- ✅ Minifigürler (17.061) — set sayfası + tekil ekle/çıkar (delta modeli)
- ✅ Koleksiyon + istek listesi (sekmeli), "Aldım! 🎉" akışı
- ✅ Takip + akış (collection_add otomatik aktivite) + beğeni
- 🔨 Vercel deploy (domainsiz, *.vercel.app)
- ⬜ Akış gönderilerine yorumlar (comments tablosu hazır)
- ⬜ Fotoğraflı paylaşım (Supabase Storage + post_media)
- ⬜ Profil düzenleme sayfası (bio, şehir, avatar yükleme, istek listesi gizliliği)
- ⬜ Kapalı beta daveti (Jestman kitlesine link + hoş geldin akışı)

## Faz 2 — Eşleştirme motoru & iletişim (platformun ayırt edici özelliği)
- ⬜ Bildirim altyapısı (notifications tablosu hazır; zil + Realtime + PWA push)
- ⬜ DM (conversations/messages UI + Realtime abonelik)
- ⬜ "Bu seti isteyenler" görünümü (contactable filtreli, bütçe girenler üstte)
- ⬜ Toplu "elimde var" mesajı (match_broadcasts günlük kota — tablo hazır)
- ⬜ Talepler sayfası (set_demand materialized view — görünüm hazır)
- ⬜ Brickset API: emeklilik tarihi + bölgesel fiyat senkronu
- ⬜ Katalog görsellerini Storage'a kopyalama (CDN bağımsızlığı)
- ⬜ Minifigür bazlı istek listesi (figür de istenebilsin)

## Faz 3 — Forum & Pazar
- ⬜ **Forum UI** (şema + 5 kategori + RLS hazır, sadece arayüz kaldı):
  - /forum: kategori listesi + gündemdeki başlıklar
  - /forum/[slug]: kategori başlıkları (pinned üstte, last_post_at sıralı)
  - /forum/konu/[id]: yanıtlar + yanıt formu (locked kontrolü DB'de hazır)
  - Yeni başlık formu; markdown-lite gövde
- ⬜ Pazar: ilan CRUD + fotoğraf + durum akışı (active→reserved→sold)
- ⬜ Satıcı puanı (yalnızca sold ilanın alıcısı — RLS hazır)
- ⬜ İlan yayınlanınca istek listesi eşleşmelerine otomatik bildirim
- ⬜ Moderasyon: rapor butonu + basit admin kuyruğu (reports tablosu hazır)

## Faz 4 — Gelir & büyüme
- ⬜ **Affiliate altyapısı** (tasarım aşağıda)
- ⬜ Rozetler / gamification (tasarım aşağıda)
- ⬜ İlan öne çıkarma (ilk gelir, düşük risk)
- ⬜ Komisyonlu güvenli ödeme / escrow (iyzico) — karar kapısı: aylık ≥100 satış
- ⬜ PWA manifest + push; sonrasında Expo (iOS/Android)

## Lansman öncesi zorunlular
- ⬜ KVKK aydınlatma + gizlilik + topluluk kuralları + pazar güvenliği sayfaları
- ⬜ SEO: meta/OG görselleri, sitemap, set sayfaları için structured data
- ⬜ Rate limiting (Vercel WAF / upstash)
- ⬜ Demo hesapları sil (demo.tugba@, demo.kaan@, deneme@jestbrick.dev)
- ⬜ DB şifresi + JWT secret rotasyonu (sohbette paylaşıldı)
- ⬜ E-posta onayını yeniden aç (Supabase) + SMTP (Resend)
- ⬜ Vercel Pro'ya geçiş (ticari kullanım şartı) — ~$20/ay
- ⬜ Analytics (Vercel Analytics veya Plausible)
- ⬜ İsim/domain kararı + marka taraması (Brickmate vb. adaylar konuşuldu)
- ⬜ Gece cron'ları Vercel Cron'a bağla (katalog + minifig + set_demand refresh)

---

## Affiliate tasarımı (Faz 4)

**Amaç:** Set sayfası ve istek listesi zaten "satın alma niyeti"nin en yüksek olduğu yer —
linkler doğal olarak oraya oturur.

**Nereden gelir:**
| Kanal | Program | Not |
|---|---|---|
| Amazon TR | Amazon Ortaklık (PartnerNet) | `?tag=SENIN-TAGIN-21`; LEGO setlerinde ~%3-6 |
| Hepsiburada / Trendyol | Admitad, TradeTracker gibi ağlar üzerinden | Türkiye'de en yüksek hacim |
| LEGO.com | Rakuten Advertising | TR'ye gönderim kısıtlı; AB kitlesi için |
| Yerel LEGO mağazaları | Doğrudan anlaşma | Jestman markasıyla birebir görüşme — en yüksek marj |

**Veri modeli:**
- `affiliate_merchants` (id, name, url_template, active) — ör. şablon:
  `https://www.amazon.com.tr/s?k=LEGO+{setNo}&tag=jestbrick-21`
- `affiliate_links` (set_num, merchant_id, url, price_try, updated_at) — set bazında
  elle/otomatik doğrulanmış derin link; yoksa şablonlu arama linkine düşer.

**Nerede görünür:**
1. Set detayında "🛒 Yeni Satın Al" kutusu (emekli değilse) — mağaza + fiyat listesi
2. İstek listesinde her setin yanında satın alma kısayolu
3. Emekli setlerde bu kutu "İkinci elde ara →" olarak kendi Pazar'ımıza döner (komisyon döngüsü)
4. İleride: creator hesaplarına kendi tag'i (gelir paylaşımı → influencer'ları platforma çeker)

**Yasal:** her affiliate linkin yanında "reklam bağlantısı" ibaresi; KVKK sayfasında açıklama.

## Rozetler / Gamification (Faz 2-3)
Eşiklere ulaşınca otomatik rozet:
- **Parça:** 1.000 / 10.000 / 50.000 / 100.000 · **Set:** 5 / 10 / 25 / 50 / 100 · **Minifigür:** 10 / 50 / 100 / 500
- Nadir/ikonik figür rozetleri; CMF seri tamamlama
- Rol rozetlerinin (★ İçerik Üreticisi, ✓ Güvenilir Satıcı) yanında profilde vitrin
- Akışa "🏅 rozet kazandı" aktivitesi → paylaşım/viral döngü
- Teknik: `badges` + `user_badges` + koleksiyon değişiminde eşik kontrolü

## Diğer fikirler
- Set detayında "B-model MOC'lar" (Rebrickable alternates, tıklayınca yükle)
- Yıllık koleksiyon özeti ("2026'da 12 set, 8.400 parça ekledin")
