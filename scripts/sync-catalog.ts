/**
 * Rebrickable → JestBrick katalog senkronu.
 *
 * Kullanım:
 *   npm run sync:catalog            → temalar + son değişen setler (artımlı, ~5 sayfa)
 *   npm run sync:catalog -- --full  → tüm katalog (~25 bin set, ilk kurulumda bir kez)
 *
 * Görsel kopyalama (Storage) bilinçli olarak ayrı tutuldu: MVP'de image_url
 * (Rebrickable CDN) kullanılır; Faz 2'de kopyalama betiği eklenecek.
 */
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });
config(); // .env varsa onu da al

const API = "https://rebrickable.com/api/v3/lego";
const KEY = process.env.REBRICKABLE_API_KEY;
const DB_URL = process.env.DATABASE_URL;

if (!KEY || !DB_URL) {
  console.error("REBRICKABLE_API_KEY ve DATABASE_URL .env.local içinde tanımlı olmalı.");
  process.exit(1);
}

const sql = postgres(DB_URL, { prepare: false });
const FULL = process.argv.includes("--full");
const PAGE_SIZE = 500;
const INCREMENTAL_PAGES = 5;

type RbTheme = { id: number; name: string; parent_id: number | null };
type RbSet = {
  set_num: string;
  name: string;
  year: number;
  theme_id: number;
  num_parts: number;
  set_img_url: string | null;
  last_modified_dt: string;
};

async function fetchPage<T>(url: string): Promise<{ next: string | null; results: T[] }> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { Authorization: `key ${KEY}` } });
    if (res.status === 429) {
      // Rebrickable hız sınırı — bekle ve tekrar dene
      const wait = attempt * 5000;
      console.log(`  hız sınırı, ${wait / 1000}sn bekleniyor…`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) throw new Error(`Rebrickable ${res.status}: ${url}`);
    return res.json();
  }
}

async function syncThemes() {
  console.log("Temalar senkronize ediliyor…");
  let url: string | null = `${API}/themes/?page_size=${PAGE_SIZE}`;
  let count = 0;
  while (url) {
    const page: { next: string | null; results: RbTheme[] } = await fetchPage<RbTheme>(url);
    for (const t of page.results) {
      await sql`
        insert into themes (id, name, parent_id)
        values (${t.id}, ${t.name}, ${t.parent_id})
        on conflict (id) do update set name = excluded.name, parent_id = excluded.parent_id
      `;
    }
    count += page.results.length;
    url = page.next;
  }
  console.log(`  ${count} tema tamam.`);
}

async function syncSets() {
  console.log(FULL ? "TÜM katalog yükleniyor (uzun sürebilir)…" : "Son değişen setler yükleniyor…");
  let url: string | null =
    `${API}/sets/?page_size=${PAGE_SIZE}&ordering=-last_modified_dt`;
  let count = 0;
  let pages = 0;

  while (url) {
    const page: { next: string | null; results: RbSet[] } = await fetchPage<RbSet>(url);
    for (const s of page.results) {
      // Paket/aksesuar kalabalığını ele: 0 parçalı kayıtları atla
      if (s.num_parts === 0) continue;
      await sql`
        insert into sets (set_num, name, theme_id, year, num_parts, image_url, last_modified)
        values (${s.set_num}, ${s.name}, ${s.theme_id}, ${s.year}, ${s.num_parts},
                ${s.set_img_url}, ${s.last_modified_dt})
        on conflict (set_num) do update set
          name = excluded.name,
          theme_id = excluded.theme_id,
          year = excluded.year,
          num_parts = excluded.num_parts,
          image_url = excluded.image_url,
          last_modified = excluded.last_modified
      `;
      count++;
    }
    pages++;
    console.log(`  sayfa ${pages} → toplam ${count} set`);
    url = page.next;
    if (!FULL && pages >= INCREMENTAL_PAGES) break;
  }
  console.log(`  ${count} set tamam.`);
}

async function refreshDemandView() {
  try {
    await sql`refresh materialized view concurrently set_demand`;
    console.log("set_demand görünümü tazelendi.");
  } catch {
    // İlk kurulumda görünüm henüz yoksa sorun değil (rls.sql çalıştırılınca oluşur)
    console.log("set_demand görünümü atlandı (henüz oluşturulmamış olabilir).");
  }
}

async function main() {
  const start = Date.now();
  try {
    await syncThemes();
    await syncSets();
    await refreshDemandView();
    console.log(`Bitti — ${Math.round((Date.now() - start) / 1000)}sn.`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
