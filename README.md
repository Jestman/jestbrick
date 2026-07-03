# JestBrick 🧱

LEGO koleksiyoncuları için sosyal ağ — koleksiyon vitrini, istek listesi eşleştirme, forum ve ikinci el pazarı.

- **Mimari dokümanı:** https://claude.ai/code/artifact/64829469-3e7b-4d1a-bbe6-95149c9b8799
- **Tıklanabilir prototip:** https://claude.ai/code/artifact/32d35e66-2784-43c8-b18f-c14601c2c073

**Stack:** Next.js 16 · Supabase (Postgres + Auth + Storage + Realtime) · Drizzle ORM · Vercel

## Kurulum (bir kez)

### 1. Bağımlılıklar

```bash
npm install
```

### 2. Supabase projesi

1. [supabase.com](https://supabase.com) → **New project** (bölge: `eu-central-1` Frankfurt önerilir).
2. **Settings → API**: `Project URL` ve `anon` anahtarını al.
3. **Settings → Database → Connection string**: **Transaction** pooler bağlantısını al.
4. `.env.example` dosyasını `.env.local` olarak kopyala ve değerleri doldur.

### 3. Şema + politikalar

```bash
npm run db:push        # Drizzle şemasını (23 tablo) Supabase'e uygular
```

Sonra Supabase panelinde **SQL Editor**'ü aç, [`db/rls.sql`](db/rls.sql) içeriğini yapıştır ve çalıştır.
Bu adım: RLS politikaları, auth tetikleyicisi (kayıt → otomatik profil), FTS indeksleri,
`set_demand` görünümü ve forum kategorilerini kurar. Tekrar çalıştırmak güvenlidir.

### 4. Set kataloğu

[rebrickable.com/api](https://rebrickable.com/api/) → ücretsiz API anahtarı al, `.env.local`'e yaz.

```bash
npm run sync:catalog -- --full   # ilk yükleme: tüm katalog (~25 bin set, birkaç dakika)
npm run sync:catalog             # sonraki çalıştırmalar: sadece değişenler
```

### 5. Çalıştır

```bash
npm run dev            # http://localhost:3002
```

## Dizin rehberi

| Yol | Ne |
|---|---|
| `db/schema.ts` | Veritabanı şemasının tek kaynağı (Drizzle) |
| `db/rls.sql` | RLS politikaları, tetikleyiciler, FTS, seed — şemayla birlikte güncellenir |
| `lib/supabase/` | Sunucu/tarayıcı Supabase istemcileri |
| `lib/auth/actions.ts` | Kayıt, giriş, çıkış, kullanıcı adı seçimi (Server Actions) |
| `proxy.ts` | Oturum tazeleme + korumalı yollar (Next 16'da middleware'in yeni adı) |
| `scripts/sync-catalog.ts` | Rebrickable → katalog senkronu |

## Faz durumu

- **Faz 0 (bu sürüm):** iskelet, auth, kullanıcı adı, katalog + arama, profil iskeleti ✅
- **Faz 1:** koleksiyon + istek listesi + takip + akış → kapalı beta
- **Faz 2:** eşleştirme motoru + bildirim + DM
- **Faz 3:** pazar (ödemesiz) + forum → lansman

## Deploy (Vercel)

1. Repoyu GitHub'a itele, Vercel'de içe aktar.
2. `.env.local` değerlerini Vercel proje ayarlarına ekle.
3. Gece katalog senkronu için Vercel Cron (Faz 1'de `app/api/cron/` eklenecek).

---

Rebrickable verisi [CC-BY](https://rebrickable.com/api/) lisanslıdır. JestBrick bağımsız bir
hayran platformudur; LEGO Group ile bağlantılı değildir. LEGO® , LEGO Group'un tescilli markasıdır.
