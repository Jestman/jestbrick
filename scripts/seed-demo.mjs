// Geliştirme ortamı için demo üyeler: akış/takip/profil özelliklerini
// gerçek veriyle denemek amacıyla 2 örnek hesap + koleksiyon + aktivite üretir.
// Idempotenttir; üretimde ÇALIŞTIRMA (demo hesaplar herkese görünür).
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

config({ path: ".env.local" });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

const DEMOS = [
  {
    email: "demo.tugba@jestbrick.dev",
    handle: "tugba_bricks",
    name: "Tuğba (Demo)",
    city: "İzmir",
    bio: "Botanical ve modüler bina tutkunu 🌿 (demo hesap)",
    sets: ["10281-1", "10312-1", "21319-1"],
  },
  {
    email: "demo.kaan@jestbrick.dev",
    handle: "kaan_moc",
    name: "Kaan (Demo)",
    city: "İstanbul",
    bio: "MOC tasarımcısı, Star Wars koleksiyoncusu (demo hesap)",
    sets: ["75192-1", "75367-1", "10323-1"],
  },
];

for (const d of DEMOS) {
  // kullanıcı var mı?
  let uid;
  const existing = await sql`select id from users where handle = ${d.handle}`;
  if (existing.length > 0) {
    uid = existing[0].id;
    console.log(`@${d.handle} zaten var, atlanıyor (koleksiyon tazelenecek)`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: d.email,
      password: "demo-sifre-1234",
      email_confirm: true,
      user_metadata: { display_name: d.name },
    });
    if (error) throw error;
    uid = data.user.id;
    await sql`
      update users set handle = ${d.handle}, display_name = ${d.name},
        city = ${d.city}, bio = ${d.bio}
      where id = ${uid}
    `;
    console.log(`@${d.handle} oluşturuldu`);
  }

  for (const setNum of d.sets) {
    const found = await sql`select 1 from sets where set_num = ${setNum}`;
    if (found.length === 0) {
      console.log(`  ${setNum} katalogda yok, atlandı`);
      continue;
    }
    const ins = await sql`
      insert into collection_items (user_id, set_num)
      values (${uid}, ${setNum})
      on conflict (user_id, set_num) do nothing
      returning id
    `;
    if (ins.length > 0) {
      await sql`
        insert into posts (author_id, kind, set_num, created_at)
        values (${uid}, 'collection_add', ${setNum},
                now() - (random() * interval '2 days'))
      `;
      console.log(`  ${setNum} koleksiyona + akışa eklendi`);
    }
  }
}

console.log("Demo tohum verisi hazır.");
await sql.end();
