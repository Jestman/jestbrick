<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data is outdated — the docs are the source of truth.

<!-- END:nextjs-agent-rules -->

# JestBrick

LEGO koleksiyoncuları için sosyal ağ. Mimari dokümanı: https://claude.ai/code/artifact/64829469-3e7b-4d1a-bbe6-95149c9b8799

- Şemanın kaynağı `db/schema.ts` (Drizzle). RLS politikaları ve tetikleyiciler `db/rls.sql` içinde — şema değişince ikisini birlikte güncelle.
- Auth: Supabase (`lib/supabase/*`, `proxy.ts` oturumu yeniler). `public.users` satırı auth tetikleyicisiyle otomatik açılır.
- Katalog salt-okunurdur; tek yazar `scripts/sync-catalog.ts`.
- UI dili Türkçe; tasarım token'ları `app/globals.css` (prototipten taşındı).
