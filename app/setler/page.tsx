import { Suspense } from "react";
import Link from "next/link";
import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { db, envReady, schema } from "@/db";

export const metadata = { title: "Set Kataloğu" };

function setImg(s: { imagePath: string | null; imageUrl: string | null; name: string }) {
  const src = s.imagePath ?? s.imageUrl;
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt={s.name} loading="lazy" /> : <span style={{ fontSize: 40 }}>🧱</span>;
}

async function SetResults({ q }: { q: string }) {
  if (!envReady()) {
    return (
      <div className="notice">
        <b>Katalog boş:</b> önce <code>.env.local</code> ayarla, sonra{" "}
        <code>npm run sync:catalog</code> ile Rebrickable kataloğunu yükle.
      </div>
    );
  }

  const base = db()
    .select({
      setNum: schema.sets.setNum,
      name: schema.sets.name,
      year: schema.sets.year,
      numParts: schema.sets.numParts,
      imagePath: schema.sets.imagePath,
      imageUrl: schema.sets.imageUrl,
      themeName: schema.themes.name,
    })
    .from(schema.sets)
    .leftJoin(schema.themes, eq(schema.sets.themeId, schema.themes.id));

  const results = q
    ? await base
        .where(
          or(
            ilike(schema.sets.name, `%${q}%`),
            ilike(schema.sets.setNum, `${q}%`),
            sql`${schema.sets.setNum} = ${q + "-1"}`
          )
        )
        .orderBy(desc(schema.sets.year))
        .limit(48)
    : await base.orderBy(desc(schema.sets.year), desc(schema.sets.numParts)).limit(48);

  if (results.length === 0) {
    return (
      <div className="notice">
        “{q}” için sonuç yok. Set numarasıyla (örn. <code>10323</code>) aramayı dene — katalog boşsa{" "}
        <code>npm run sync:catalog</code> çalıştırılmalı.
      </div>
    );
  }

  return (
    <div className="setgrid">
      {results.map((s) => (
        <Link key={s.setNum} href={`/setler/${s.setNum}`} className="setcard">
          <div className="img">{setImg(s)}</div>
          <div className="meta">
            <b>{s.name}</b>
            <small>
              #{s.setNum.replace(/-1$/, "")} · {s.themeName ?? "—"} · {s.numParts.toLocaleString("tr-TR")} parça · {s.year}
            </small>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default async function SetlerPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;

  return (
    <main className="wrap">
      <h1 className="page">Set Kataloğu</h1>
      <form className="searchbar" action="/setler">
        <input
          name="q"
          defaultValue={q}
          placeholder="Set adı veya numarası ara… (örn. 10323, Rivendell)"
          autoComplete="off"
        />
        <button className="btn btn-y">Ara</button>
      </form>
      <Suspense key={q} fallback={<p style={{ color: "var(--ink3)" }}>Aranıyor…</p>}>
        <SetResults q={q.trim()} />
      </Suspense>
    </main>
  );
}
