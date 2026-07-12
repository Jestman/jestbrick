/**
 * Brickset → JestBrick set zenginleştirme senkronu.
 * Doldurduğu alanlar: retired_at (exitDate), msrp_try boşsa DE fiyatından
 * hesaplanmaz (döviz spekülasyonu yok) — sadece emeklilik verisi esastır.
 *
 * Kullanım:
 *   npm run sync:brickset            → son 3 günde güncellenen setler (artımlı)
 *   npm run sync:brickset -- --full  → tüm katalog, yıl gruplarıyla (ilk kurulum)
 *
 * Not: Ücretsiz anahtar günde ~100 istek — full mod yıl gruplarını 500'lük
 * sayfalara sığdırarak ~70 istekte biter; istekler 1,2 sn arayla atılır.
 * Limit aşımında script durur, ertesi gün kaldığı YILDAN devam edilebilir:
 *   npm run sync:brickset -- --full --from=1998
 */
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });
config();

const KEY = process.env.BRICKSET_API_KEY;
const DB_URL = process.env.DATABASE_URL;
if (!KEY || !DB_URL) {
  console.error("BRICKSET_API_KEY ve DATABASE_URL .env.local içinde tanımlı olmalı.");
  process.exit(1);
}

const sql = postgres(DB_URL, { prepare: false });
const FULL = process.argv.includes("--full");
const FROM_YEAR = Number(
  (process.argv.find((a) => a.startsWith("--from=")) ?? "--from=0").split("=")[1]
);
const PAGE_SIZE = 500;
const BATCH_CAP = 400; // yıl grubu bizim sayımıza göre bu kadar seti geçmesin

type BricksetSet = {
  number: string;
  numberVariant: number;
  exitDate?: string;
  launchDate?: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getSets(params: Record<string, unknown>): Promise<BricksetSet[]> {
  const url =
    "https://brickset.com/api/v3.asmx/getSets?apiKey=" +
    encodeURIComponent(KEY!) +
    "&userHash=&params=" +
    encodeURIComponent(JSON.stringify(params));

  // Geçici hatalar (HTML yanıt, 5xx) için artan bekleme ile 3 deneme
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      if (!text.trimStart().startsWith("{")) {
        throw new Error(`JSON değil (HTTP ${res.status}) — muhtemel geçici engel`);
      }
      const data = JSON.parse(text) as {
        status: string;
        message?: string;
        sets?: BricksetSet[];
      };
      if (data.status !== "success") {
        // Kota aşımı kalıcıdır, tekrar deneme
        throw Object.assign(new Error(`Brickset hata: ${data.message ?? "bilinmeyen"}`), {
          permanent: /limit|exceeded/i.test(data.message ?? ""),
        });
      }
      return data.sets ?? [];
    } catch (e) {
      const perm = (e as { permanent?: boolean }).permanent;
      if (perm || attempt >= 3) throw e;
      const wait = attempt * 10_000;
      process.stdout.write(`\n  geçici hata (${(e as Error).message}), ${wait / 1000} sn bekleyip tekrar…\n`);
      await sleep(wait);
    }
  }
}

/** Gelen sayfayı tek toplu UPDATE ile işler; dönen değer: güncellenen satır sayısı. */
async function applySets(sets: BricksetSet[]): Promise<number> {
  const withExit = sets.filter((s) => s.exitDate);
  if (withExit.length === 0) return 0;
  const setNums = withExit.map((s) => `${s.number}-${s.numberVariant}`);
  const exits = withExit.map((s) => s.exitDate!.slice(0, 10));

  const r = await sql`
    update sets set retired_at = v.exit
    from unnest(${setNums}::text[], ${exits}::date[]) as v(set_num, exit)
    where sets.set_num = v.set_num
      and sets.retired_at is distinct from v.exit
      and v.exit <= current_date
  `;
  return r.count;
}

async function fullSync() {
  // Yıl başına set sayımız → BATCH_CAP'i aşmayan yıl grupları
  const rows = await sql<{ year: number; n: number }[]>`
    select year, count(*)::int as n from sets
    where year >= ${FROM_YEAR}
    group by year order by year
  `;
  const batches: number[][] = [];
  let cur: number[] = [];
  let curN = 0;
  for (const r of rows) {
    if (cur.length > 0 && curN + r.n > BATCH_CAP) {
      batches.push(cur);
      cur = [];
      curN = 0;
    }
    cur.push(r.year);
    curN += r.n;
  }
  if (cur.length > 0) batches.push(cur);
  console.log(`${rows.length} yıl → ${batches.length} istek grubu`);

  let requests = 0;
  let totalUpdated = 0;
  for (const years of batches) {
    let page = 1;
    for (;;) {
      try {
        const sets = await getSets({
          year: years.join(","),
          pageSize: PAGE_SIZE,
          pageNumber: page,
        });
        requests++;
        totalUpdated += await applySets(sets);
        process.stdout.write(
          `\r${years[0]}${years.length > 1 ? `-${years.at(-1)}` : ""} s${page} | istek ${requests} | güncellenen ${totalUpdated}   `
        );
        if (sets.length < PAGE_SIZE) break;
        page++;
      } catch (e) {
        console.error(`\nDurdu (${years[0]} yılında): ${(e as Error).message}`);
        console.error(`Yarın şuradan devam et: npm run sync:brickset -- --full --from=${years[0]}`);
        return;
      }
      await sleep(1200);
    }
    await sleep(1200);
  }
  console.log(`\nBitti: ${requests} istek, ${totalUpdated} set güncellendi.`);
}

async function incrementalSync() {
  // Son 3 günde Brickset'te güncellenen setler (günlük cron için ideal)
  const since = new Date(Date.now() - 3 * 86400_000).toISOString().slice(0, 10);
  let page = 1;
  let totalUpdated = 0;
  for (;;) {
    const sets = await getSets({ updatedSince: since, pageSize: PAGE_SIZE, pageNumber: page });
    totalUpdated += await applySets(sets);
    if (sets.length < PAGE_SIZE) break;
    page++;
    await sleep(1200);
  }
  console.log(`Artımlı senkron bitti (${since} sonrası): ${totalUpdated} set güncellendi.`);
}

(FULL ? fullSync() : incrementalSync())
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
