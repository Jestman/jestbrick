import { Suspense } from "react";
import Link from "next/link";
import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, lte, or, sql } from "drizzle-orm";
import { db, envReady, schema } from "@/db";
import { getUser } from "@/lib/supabase/server";
import { addToCollection } from "@/lib/collection/actions";
import { PendingButton } from "@/app/components/PendingButton";

export const metadata = {
  title: "Set Kataloğu",
  description:
    "20 bine yakın LEGO seti: tema ve yıla göre filtrele, emeklileri bul, koleksiyonuna ekle.",
};

const PAGE_SIZE = 24;

const YEAR_RANGES: Record<string, [number, number] | undefined> = {
  "2026": [2026, 2026],
  "2025": [2025, 2025],
  "2024": [2024, 2024],
  "2023": [2023, 2023],
  "2020-2022": [2020, 2022],
  "2010lar": [2010, 2019],
  "2000ler": [2000, 2009],
  "1990lar": [1990, 1999],
  eski: [1949, 1989],
};

type Filters = { q: string; tema?: number; yil?: string; emekli?: boolean; sirala?: string };

function buildWhere(f: Filters) {
  const cond = [];
  if (f.q)
    cond.push(
      or(
        ilike(schema.sets.name, `%${f.q}%`),
        ilike(schema.sets.setNum, `${f.q}%`),
        sql`${schema.sets.setNum} = ${f.q + "-1"}`
      )
    );
  if (f.tema) cond.push(eq(schema.sets.themeId, f.tema));
  const yr = f.yil ? YEAR_RANGES[f.yil] : undefined;
  if (yr) {
    cond.push(gte(schema.sets.year, yr[0]));
    cond.push(lte(schema.sets.year, yr[1]));
  }
  if (f.emekli) cond.push(isNotNull(schema.sets.retiredAt));
  return cond.length > 0 ? and(...cond) : undefined;
}

async function SetResults({ f, page }: { f: Filters; page: number }) {
  if (!envReady()) {
    return (
      <div className="notice">
        <b>Katalog boş:</b> önce <code>.env.local</code> ayarla, sonra{" "}
        <code>npm run sync:catalog</code> ile Rebrickable kataloğunu yükle.
      </div>
    );
  }

  const where = buildWhere(f);
  const order =
    f.sirala === "parca"
      ? [desc(schema.sets.numParts)]
      : f.sirala === "ad"
        ? [asc(schema.sets.name)]
        : f.sirala === "eski"
          ? [asc(schema.sets.year), asc(schema.sets.name)]
          : [desc(schema.sets.year), desc(schema.sets.numParts)];

  const [[{ total }], results, user] = await Promise.all([
    db().select({ total: sql<number>`count(*)::int` }).from(schema.sets).where(where),
    db()
      .select({
        setNum: schema.sets.setNum,
        name: schema.sets.name,
        year: schema.sets.year,
        numParts: schema.sets.numParts,
        imagePath: schema.sets.imagePath,
        imageUrl: schema.sets.imageUrl,
        retiredAt: schema.sets.retiredAt,
        themeName: schema.themes.name,
      })
      .from(schema.sets)
      .leftJoin(schema.themes, eq(schema.sets.themeId, schema.themes.id))
      .where(where)
      .orderBy(...order)
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    getUser(),
  ]);

  // girişli kullanıcının bu sayfadaki setlerden hangileri koleksiyonunda?
  const ownedSet = new Set<string>();
  if (user && results.length > 0) {
    const owned = await db()
      .select({ setNum: schema.collectionItems.setNum })
      .from(schema.collectionItems)
      .where(
        and(
          eq(schema.collectionItems.userId, user.id),
          inArray(
            schema.collectionItems.setNum,
            results.map((r) => r.setNum)
          )
        )
      );
    for (const o of owned) ownedSet.add(o.setNum);
  }

  if (results.length === 0) {
    return (
      <div className="notice">
        Bu filtrelere uyan set yok — aramayı genişletmeyi dene.
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageLink = (p: number) => {
    const params = new URLSearchParams();
    if (f.q) params.set("q", f.q);
    if (f.tema) params.set("tema", String(f.tema));
    if (f.yil) params.set("yil", f.yil);
    if (f.emekli) params.set("emekli", "1");
    if (f.sirala) params.set("sirala", f.sirala);
    if (p > 1) params.set("sayfa", String(p));
    const qs = params.toString();
    return `/setler${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <p style={{ fontSize: 13, color: "var(--ink3)", margin: "0 0 14px" }}>
        <b>{total.toLocaleString("tr-TR")}</b> set bulundu · sayfa {page}/{totalPages}
      </p>
      <div className="setgrid">
        {results.map((s) => (
          <div key={s.setNum} className="setcard">
            <Link href={`/setler/${s.setNum}`} style={{ color: "inherit", display: "block" }}>
              <div className="img" style={{ position: "relative" }}>
                {(s.imagePath ?? s.imageUrl) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.imagePath ?? s.imageUrl ?? ""} alt={s.name} loading="lazy" />
                ) : (
                  <span style={{ fontSize: 40 }}>🧱</span>
                )}
                {s.retiredAt && (
                  <span style={{ position: "absolute", top: 8, left: 8, background: "var(--red)", color: "#fff", fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 99 }}>
                    EMEKLİ
                  </span>
                )}
              </div>
              <div className="meta">
                <b>{s.name}</b>
                <small>
                  #{s.setNum.replace(/-1$/, "")} · {s.themeName ?? "—"} · {s.numParts.toLocaleString("tr-TR")} parça · {s.year}
                </small>
              </div>
            </Link>
            {user && (
              <div style={{ padding: "0 14px 12px" }}>
                {ownedSet.has(s.setNum) ? (
                  <span style={{ fontSize: 12.5, color: "var(--green)", fontWeight: 700 }}>✓ Koleksiyonunda</span>
                ) : (
                  <form action={addToCollection}>
                    <input type="hidden" name="setNum" value={s.setNum} />
                    <input type="hidden" name="back" value="/setler" />
                    <PendingButton className="btn btn-o" style={{ padding: "4px 12px", fontSize: 12.5 }} pendingText="Ekleniyor…">
                      + Koleksiyona
                    </PendingButton>
                  </form>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 10, justifyContent: "center", alignItems: "center", marginTop: 24, fontSize: 14 }}>
          {page > 1 ? (
            <Link href={pageLink(page - 1)} className="btn btn-o" style={{ padding: "7px 16px", fontSize: 13 }}>
              ← Önceki
            </Link>
          ) : (
            <span />
          )}
          <span style={{ color: "var(--ink3)", fontSize: 13 }}>
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link href={pageLink(page + 1)} className="btn btn-o" style={{ padding: "7px 16px", fontSize: 13 }}>
              Sonraki →
            </Link>
          )}
        </div>
      )}
    </>
  );
}

export default async function SetlerPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tema?: string; yil?: string; emekli?: string; sirala?: string; sayfa?: string }>;
}) {
  const sp = await searchParams;
  const f: Filters = {
    q: (sp.q ?? "").trim(),
    tema: sp.tema && /^\d+$/.test(sp.tema) ? Number(sp.tema) : undefined,
    yil: sp.yil,
    emekli: sp.emekli === "1",
    sirala: sp.sirala,
  };
  const page = Math.max(1, Number(sp.sayfa) || 1);

  // popüler temalar (set sayısına göre ilk 30)
  const themes = envReady()
    ? await db()
        .select({
          id: schema.themes.id,
          name: schema.themes.name,
          n: sql<number>`count(*)::int`,
        })
        .from(schema.sets)
        .innerJoin(schema.themes, eq(schema.sets.themeId, schema.themes.id))
        .groupBy(schema.themes.id, schema.themes.name)
        .orderBy(desc(sql`count(*)`))
        .limit(30)
    : [];
  themes.sort((a, b) => a.name.localeCompare(b.name, "tr"));

  const selStyle: React.CSSProperties = {
    padding: "8px 10px", border: "1.5px solid var(--line)", borderRadius: 9,
    fontSize: 13, background: "#fff",
  };
  const hasFilter = !!(f.tema || f.yil || f.emekli || f.sirala || f.q);

  return (
    <main className="wrap">
      <h1 className="page">Set Kataloğu</h1>
      <form className="searchbar" action="/setler" style={{ marginBottom: 10 }}>
        <input
          name="q"
          defaultValue={f.q}
          placeholder="Set adı veya numarası ara… (örn. 10323, Rivendell)"
          autoComplete="off"
        />
        <button className="btn btn-y">Ara</button>
      </form>
      <form method="get" action="/setler" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 18 }}>
        {f.q && <input type="hidden" name="q" value={f.q} />}
        <select name="tema" defaultValue={f.tema ? String(f.tema) : ""} style={selStyle}>
          <option value="">Tema: tümü</option>
          {themes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.n})
            </option>
          ))}
        </select>
        <select name="yil" defaultValue={f.yil ?? ""} style={selStyle}>
          <option value="">Yıl: tümü</option>
          <option value="2026">2026</option>
          <option value="2025">2025</option>
          <option value="2024">2024</option>
          <option value="2023">2023</option>
          <option value="2020-2022">2020-2022</option>
          <option value="2010lar">2010'lar</option>
          <option value="2000ler">2000'ler</option>
          <option value="1990lar">1990'lar</option>
          <option value="eski">1989 ve öncesi</option>
        </select>
        <select name="sirala" defaultValue={f.sirala ?? ""} style={selStyle}>
          <option value="">En yeni</option>
          <option value="parca">Parça sayısı</option>
          <option value="ad">Ada göre (A-Z)</option>
          <option value="eski">En eski</option>
        </select>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" name="emekli" value="1" defaultChecked={f.emekli} />
          Sadece emekliler
        </label>
        <button className="btn btn-o" type="submit" style={{ padding: "7px 14px", fontSize: 13 }}>
          Filtrele
        </button>
        {hasFilter && (
          <Link href="/setler" style={{ fontSize: 12.5, fontWeight: 600 }}>✕ temizle</Link>
        )}
      </form>
      <Suspense key={JSON.stringify({ f, page })} fallback={<p style={{ color: "var(--ink3)" }}>Aranıyor…</p>}>
        <SetResults f={f} page={page} />
      </Suspense>
    </main>
  );
}
