/**
 * Rebrickable CSV dökümlerinden minifigür senkronu.
 * API'ye set başına istek atmak yerine 3 hazır dökümü indirir (~saniyeler):
 *   minifigs.csv.gz            → fig_num, name, num_parts, img_url
 *   inventories.csv.gz         → id, version, set_num
 *   inventory_minifigs.csv.gz  → inventory_id, fig_num, quantity
 *
 * Kullanım: npx tsx scripts/sync-minifigs.ts
 * Not: sets tablosu dolu olmalı (önce sync:catalog).
 */
import { config } from "dotenv";
import { gunzipSync } from "node:zlib";
import postgres from "postgres";

config({ path: ".env.local" });
config();

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("DATABASE_URL tanımlı değil.");
  process.exit(1);
}
const sql = postgres(DB_URL, { prepare: false, max: 1 });

const CDN = "https://cdn.rebrickable.com/media/downloads";

async function downloadCsv(name: string): Promise<string[][]> {
  console.log(`${name} indiriliyor…`);
  const res = await fetch(`${CDN}/${name}.csv.gz`);
  if (!res.ok) throw new Error(`${name} indirilemedi: ${res.status}`);
  const text = gunzipSync(Buffer.from(await res.arrayBuffer())).toString("utf8");
  return parseCsv(text);
}

/** RFC-4180'e yeterince sadık, tırnaklı alanları destekleyen küçük CSV çözücü. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "", row: string[] = [], inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); field = ""; if (row.length > 1 || row[0] !== "") rows.push(row); row = []; }
    else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function indexBy(header: string[]) {
  const m = new Map(header.map((h, i) => [h.trim(), i]));
  return (name: string) => {
    const i = m.get(name);
    if (i === undefined) throw new Error(`CSV kolonu yok: ${name} (var olanlar: ${header.join(", ")})`);
    return i;
  };
}

async function main() {
  const start = Date.now();

  // 1) minifigs.csv → minifigs tablosu
  const figsCsv = await downloadCsv("minifigs");
  const figCol = indexBy(figsCsv[0]);
  const figRows = figsCsv.slice(1).map((r) => ({
    fig_num: r[figCol("fig_num")],
    name: r[figCol("name")],
    num_parts: Number(r[figCol("num_parts")] || 0),
    image_url: r[figCol("img_url")] || null,
  }));
  console.log(`${figRows.length} minifigür yükleniyor…`);
  for (let i = 0; i < figRows.length; i += 1000) {
    const batch = figRows.slice(i, i + 1000);
    await sql`
      insert into minifigs ${sql(batch, "fig_num", "name", "num_parts", "image_url")}
      on conflict (fig_num) do update set
        name = excluded.name, num_parts = excluded.num_parts, image_url = excluded.image_url
    `;
  }

  // 2) inventories: set başına en güncel envanter sürümü
  const invCsv = await downloadCsv("inventories");
  const invCol = indexBy(invCsv[0]);
  const latestInv = new Map<string, { id: string; version: number }>(); // set_num → inventory
  const invSet = new Map<string, string>(); // inventory_id → set_num
  for (const r of invCsv.slice(1)) {
    const setNum = r[invCol("set_num")];
    const version = Number(r[invCol("version")]);
    const id = r[invCol("id")];
    const cur = latestInv.get(setNum);
    if (!cur || version > cur.version) latestInv.set(setNum, { id, version });
  }
  for (const [setNum, { id }] of latestInv) invSet.set(id, setNum);

  // 3) inventory_minifigs → set_minifigs (yalnızca katalogda VAR olan setler)
  const imCsv = await downloadCsv("inventory_minifigs");
  const imCol = indexBy(imCsv[0]);
  const known = new Set((await sql`select set_num from sets`).map((r) => r.set_num as string));
  const knownFigs = new Set(figRows.map((f) => f.fig_num));

  const linkRows: { set_num: string; fig_num: string; quantity: number }[] = [];
  for (const r of imCsv.slice(1)) {
    const setNum = invSet.get(r[imCol("inventory_id")]);
    if (!setNum || !known.has(setNum)) continue;
    const figNum = r[imCol("fig_num")];
    if (!knownFigs.has(figNum)) continue;
    linkRows.push({ set_num: setNum, fig_num: figNum, quantity: Number(r[imCol("quantity")] || 1) });
  }
  console.log(`${linkRows.length} set-minifigür bağı yükleniyor…`);
  for (let i = 0; i < linkRows.length; i += 1000) {
    const batch = linkRows.slice(i, i + 1000);
    await sql`
      insert into set_minifigs ${sql(batch, "set_num", "fig_num", "quantity")}
      on conflict (set_num, fig_num) do update set quantity = excluded.quantity
    `;
  }

  const [{ figs }] = await sql`select count(*)::int as figs from minifigs`;
  const [{ links }] = await sql`select count(*)::int as links from set_minifigs`;
  console.log(`Bitti — ${figs} minifigür, ${links} bağ, ${Math.round((Date.now() - start) / 1000)}sn.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => sql.end());
