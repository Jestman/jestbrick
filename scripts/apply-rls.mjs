// db/rls.sql dosyasını Supabase'e uygular (SQL Editor'e elle yapıştırma gerekmez).
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import postgres from "postgres";

config({ path: ".env.local" });

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const ddl = readFileSync("db/rls.sql", "utf8");

try {
  await sql.unsafe(ddl);
  const [{ count }] = await sql`
    select count(*)::int as count from pg_policies where schemaname = 'public'
  `;
  const [{ trg }] = await sql`
    select count(*)::int as trg from pg_trigger where tgname in ('on_auth_user_created','likes_counter','topic_last_post')
  `;
  const cats = await sql`select count(*)::int as c from forum_categories`;
  console.log(`OK — ${count} RLS politikası, ${trg} tetikleyici, ${cats[0].c} forum kategorisi.`);
} finally {
  await sql.end();
}
