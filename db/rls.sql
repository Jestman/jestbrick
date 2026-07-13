-- JestBrick — RLS politikaları, tetikleyiciler, FTS ve görünümler.
-- `npm run db:push` ile şema kurulduktan SONRA Supabase SQL Editor'de çalıştır.
-- Idempotent: tekrar çalıştırmak güvenlidir.

-- ============ uzantılar ============
create extension if not exists pg_trgm;

-- ============ auth.users bağlantısı ============
-- public.users.id → auth.users.id ve kayıt anında otomatik profil satırı.
alter table public.users
  drop constraint if exists users_id_auth_fk;
alter table public.users
  add constraint users_id_auth_fk
  foreign key (id) references auth.users (id) on delete cascade;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, handle, display_name)
  values (
    new.id,
    'uye_' || substr(replace(new.id::text, '-', ''), 1, 10), -- geçici handle; kurulumda seçilir
    coalesce(new.raw_user_meta_data->>'display_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- profil görünürlüğü (12 Tem 2026): kapalıysa üye olmayanlara vitrin gizlenir
alter table public.users add column if not exists profile_public boolean not null default true;

-- handle küçük harf ve biçim garantisi
alter table public.users drop constraint if exists users_handle_format;
alter table public.users add constraint users_handle_format
  check (handle ~ '^[a-z0-9_\.]{3,24}$');

-- seller_ratings puan aralığı
alter table public.seller_ratings drop constraint if exists seller_ratings_score_range;
alter table public.seller_ratings add constraint seller_ratings_score_range
  check (score between 1 and 5);

-- ============ katalog FTS ============
alter table public.sets
  add column if not exists search tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(name_tr, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(set_num, '')), 'B')
  ) stored;

create index if not exists sets_search_idx on public.sets using gin (search);
create index if not exists sets_name_trgm_idx on public.sets using gin (name gin_trgm_ops);

-- ============ talep görünümü ============
-- /talepler canlı sorgu kullanır; eski set_demand MV kaldırıldı (12 Tem 2026).
drop materialized view if exists public.set_demand;

-- ============ RLS ============
alter table public.users enable row level security;
alter table public.follows enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.themes enable row level security;
alter table public.sets enable row level security;
alter table public.minifigs enable row level security;
alter table public.set_minifigs enable row level security;
alter table public.collection_items enable row level security;
alter table public.collection_minifigs enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.posts enable row level security;
alter table public.post_media enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.forum_categories enable row level security;
alter table public.topics enable row level security;
alter table public.topic_posts enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;
alter table public.seller_ratings enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.match_broadcasts enable row level security;
alter table public.notifications enable row level security;

-- Yardımcı: politika varsa düşür (idempotentlik için hepsi drop+create)

-- ---- katalog: herkes okur, sadece service_role yazar ----
drop policy if exists sets_read on public.sets;
create policy sets_read on public.sets for select using (true);
drop policy if exists themes_read on public.themes;
create policy themes_read on public.themes for select using (true);
drop policy if exists minifigs_read on public.minifigs;
create policy minifigs_read on public.minifigs for select using (true);
drop policy if exists set_minifigs_read on public.set_minifigs;
create policy set_minifigs_read on public.set_minifigs for select using (true);
-- yazma politikası yok → anon/authenticated yazamaz; service_role RLS'i zaten atlar

-- ---- profiller: herkes okur, sahibi günceller ----
drop policy if exists users_read on public.users;
create policy users_read on public.users for select using (true);
drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users for update
  using (auth.uid() = id) with check (auth.uid() = id);

-- ---- takip / engel ----
drop policy if exists follows_read on public.follows;
create policy follows_read on public.follows for select using (true);
drop policy if exists follows_write_own on public.follows;
create policy follows_write_own on public.follows for insert
  with check (auth.uid() = follower_id);
drop policy if exists follows_delete_own on public.follows;
create policy follows_delete_own on public.follows for delete
  using (auth.uid() = follower_id);

drop policy if exists blocks_own on public.blocks;
create policy blocks_own on public.blocks for all
  using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);

drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert
  with check (auth.uid() = reporter_id);

-- ---- koleksiyon: public görünür, sahibi her şeyi yapar ----
drop policy if exists collection_read on public.collection_items;
create policy collection_read on public.collection_items for select
  using (visibility = 'public' or auth.uid() = user_id);
drop policy if exists collection_write_own on public.collection_items;
create policy collection_write_own on public.collection_items for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists collection_minifigs_read on public.collection_minifigs;
create policy collection_minifigs_read on public.collection_minifigs for select
  using (true); -- profil vitrini herkese açık; gizlilik seçeneği Faz 2
drop policy if exists collection_minifigs_write_own on public.collection_minifigs;
create policy collection_minifigs_write_own on public.collection_minifigs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---- istek listesi: gizlilik iki anahtarlı ----
-- wishlist_public=false olan kullanıcının istekleri başkasına görünmez;
-- contactable filtresi uygulama sorgusunda ("İsteyenler" görünümü) uygulanır.
drop policy if exists wishlist_read on public.wishlist_items;
create policy wishlist_read on public.wishlist_items for select
  using (
    auth.uid() = user_id
    or exists (select 1 from public.users u where u.id = user_id and u.wishlist_public)
  );
drop policy if exists wishlist_write_own on public.wishlist_items;
create policy wishlist_write_own on public.wishlist_items for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---- sosyal içerik ----
drop policy if exists posts_read on public.posts;
create policy posts_read on public.posts for select using (true);
drop policy if exists posts_write_own on public.posts;
create policy posts_write_own on public.posts for all
  using (auth.uid() = author_id) with check (auth.uid() = author_id);

drop policy if exists post_media_read on public.post_media;
create policy post_media_read on public.post_media for select using (true);
drop policy if exists post_media_write_own on public.post_media;
create policy post_media_write_own on public.post_media for all
  using (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()))
  with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));

drop policy if exists likes_read on public.likes;
create policy likes_read on public.likes for select using (true);
drop policy if exists likes_write_own on public.likes;
create policy likes_write_own on public.likes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists comments_read on public.comments;
create policy comments_read on public.comments for select using (true);
drop policy if exists comments_write_own on public.comments;
create policy comments_write_own on public.comments for all
  using (auth.uid() = author_id) with check (auth.uid() = author_id);

-- beğeni sayacı
create or replace function public.bump_like_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
    return new;
  else
    update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
    return old;
  end if;
end;
$$;
drop trigger if exists likes_counter on public.likes;
create trigger likes_counter
  after insert or delete on public.likes
  for each row execute function public.bump_like_count();

-- ---- forum ----
drop policy if exists forum_categories_read on public.forum_categories;
create policy forum_categories_read on public.forum_categories for select using (true);

drop policy if exists topics_read on public.topics;
create policy topics_read on public.topics for select using (true);
drop policy if exists topics_write_own on public.topics;
create policy topics_write_own on public.topics for insert
  with check (auth.uid() = author_id);
drop policy if exists topics_update_own on public.topics;
create policy topics_update_own on public.topics for update
  using (auth.uid() = author_id) with check (auth.uid() = author_id);

drop policy if exists topic_posts_read on public.topic_posts;
create policy topic_posts_read on public.topic_posts for select using (true);
drop policy if exists topic_posts_write_own on public.topic_posts;
create policy topic_posts_write_own on public.topic_posts for insert
  with check (
    auth.uid() = author_id
    and not exists (select 1 from public.topics t where t.id = topic_id and t.locked)
  );

-- yanıt gelince başlığı öne al
create or replace function public.bump_topic_last_post()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.topics set last_post_at = now() where id = new.topic_id;
  return new;
end;
$$;
drop trigger if exists topic_last_post on public.topic_posts;
create trigger topic_last_post
  after insert on public.topic_posts
  for each row execute function public.bump_topic_last_post();

-- ---- pazar ----
drop policy if exists listings_read on public.listings;
create policy listings_read on public.listings for select using (true);
drop policy if exists listings_write_own on public.listings;
create policy listings_write_own on public.listings for all
  using (auth.uid() = seller_id) with check (auth.uid() = seller_id);

drop policy if exists listing_images_read on public.listing_images;
create policy listing_images_read on public.listing_images for select using (true);
drop policy if exists listing_images_write_own on public.listing_images;
create policy listing_images_write_own on public.listing_images for all
  using (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()))
  with check (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()));

drop policy if exists seller_ratings_read on public.seller_ratings;
create policy seller_ratings_read on public.seller_ratings for select using (true);
drop policy if exists seller_ratings_insert on public.seller_ratings;
create policy seller_ratings_insert on public.seller_ratings for insert
  with check (
    auth.uid() = rater_id
    and exists (select 1 from public.listings l where l.id = listing_id and l.status = 'sold')
  );

-- ---- mesajlaşma: sadece katılımcılar ----
create or replace function public.is_participant(conv uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = conv and user_id = auth.uid()
  );
$$;

drop policy if exists conversations_participant on public.conversations;
create policy conversations_participant on public.conversations for select
  using (public.is_participant(id));
drop policy if exists conversations_insert on public.conversations;
create policy conversations_insert on public.conversations for insert
  with check (auth.uid() is not null);

drop policy if exists participants_read on public.conversation_participants;
create policy participants_read on public.conversation_participants for select
  using (public.is_participant(conversation_id));
drop policy if exists participants_insert on public.conversation_participants;
create policy participants_insert on public.conversation_participants for insert
  with check (public.is_participant(conversation_id) or auth.uid() = user_id);
drop policy if exists participants_update_own on public.conversation_participants;
create policy participants_update_own on public.conversation_participants for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages for select
  using (public.is_participant(conversation_id));
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert
  with check (auth.uid() = sender_id and public.is_participant(conversation_id));

drop policy if exists broadcasts_own on public.match_broadcasts;
create policy broadcasts_own on public.match_broadcasts for all
  using (auth.uid() = sender_id) with check (auth.uid() = sender_id);

drop policy if exists notifications_own_read on public.notifications;
create policy notifications_own_read on public.notifications for select
  using (auth.uid() = user_id);
drop policy if exists notifications_own_update on public.notifications;
create policy notifications_own_update on public.notifications for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- İlanın JestBrick üzerinden satıldığı işareti (13 Tem 2026)
alter table public.listings add column if not exists sold_via_jestbrick boolean not null default false;

-- ============ site ayarları (yönetim paneli aç-kapa anahtarları) ============
-- Enum güncellemesi: alter type user_role add value if not exists 'moderator';
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default 'true'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
drop policy if exists site_settings_read on public.site_settings;
create policy site_settings_read on public.site_settings for select using (true);
insert into public.site_settings (key, value) values
  ('market_enabled', 'true'), ('forum_enabled', 'true'), ('signup_enabled', 'true')
on conflict (key) do nothing;

-- ============ Realtime yayını (DM ve bildirimler canlı düşsün) ============
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- ============ başlangıç verisi: forum kategorileri ============
insert into public.forum_categories (id, name, slug, icon, description, position) values
  (1, 'Yeni Setler & Söylentiler', 'yeni-setler', '🆕', 'Duyurular, sızıntılar, beklenen setler', 1),
  (2, 'Koleksiyon & Yatırım', 'koleksiyon-yatirim', '📈', 'Emekli setler, değerleme, saklama', 2),
  (3, 'MOC & Teknikler', 'moc-teknikler', '🧱', 'Kendi tasarımların, yapım teknikleri', 3),
  (4, 'Alım-Satım Rehberi', 'alim-satim', '🤝', 'Pazar kuralları, güvenli alışveriş, kargo', 4),
  (5, 'Genel Sohbet', 'genel', '☕', 'LEGO dünyasından her şey', 5)
on conflict (id) do update
  set name = excluded.name, icon = excluded.icon,
      description = excluded.description, position = excluded.position;
