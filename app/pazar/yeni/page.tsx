import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq, sql } from "drizzle-orm";
import { db, envReady, schema } from "@/db";
import { getUser } from "@/lib/supabase/server";
import { YeniIlanForm } from "./YeniIlanForm";

export const metadata = { title: "İlan Ver" };

/** Set seçilmemişse arama; seçilmişse ilan formu. */
export default async function YeniIlanPage({
  searchParams,
}: {
  searchParams: Promise<{ set?: string; q?: string }>;
}) {
  if (!envReady()) redirect("/");
  const user = await getUser();
  if (!user) redirect("/giris?sonra=/pazar/yeni");

  const { set, q } = await searchParams;

  // 1) Set seçildi → form
  if (set) {
    const [setRow] = await db()
      .select({ setNum: schema.sets.setNum, name: schema.sets.name })
      .from(schema.sets)
      .where(eq(schema.sets.setNum, set));
    if (setRow) {
      const [me] = await db()
        .select({ city: schema.users.city })
        .from(schema.users)
        .where(eq(schema.users.id, user.id));
      return (
        <main className="wrap" style={{ maxWidth: 560 }}>
          <Link href="/pazar/yeni" style={{ fontSize: 13.5, fontWeight: 600 }}>← Başka set seç</Link>
          <h1 className="page" style={{ marginTop: 10 }}>İlan Ver</h1>
          <YeniIlanForm setNum={setRow.setNum} setName={setRow.name} defaultCity={me?.city ?? null} />
        </main>
      );
    }
  }

  // 2) Set seçimi: önce koleksiyondakiler, sonra arama
  const [mine, results] = await Promise.all([
    db()
      .select({ setNum: schema.sets.setNum, name: schema.sets.name })
      .from(schema.collectionItems)
      .innerJoin(schema.sets, eq(schema.collectionItems.setNum, schema.sets.setNum))
      .where(eq(schema.collectionItems.userId, user.id))
      .orderBy(asc(schema.sets.name))
      .limit(30),
    q && q.trim().length >= 2
      ? db()
          .select({ setNum: schema.sets.setNum, name: schema.sets.name, year: schema.sets.year })
          .from(schema.sets)
          .where(
            sql`${schema.sets.name} ilike ${"%" + q.trim() + "%"} or ${schema.sets.setNum} ilike ${q.trim() + "%"}`
          )
          .orderBy(asc(schema.sets.name))
          .limit(20)
      : Promise.resolve([]),
  ]);

  return (
    <main className="wrap" style={{ maxWidth: 560 }}>
      <h1 className="page">İlan Ver — Set Seç</h1>

      <form method="get" style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <input
          name="q" defaultValue={q ?? ""} placeholder="Set adı veya numarası ara…"
          style={{
            flex: 1, padding: "10px 14px", border: "1.5px solid var(--line)",
            borderRadius: 10, fontSize: 14,
          }}
        />
        <button className="btn btn-y" type="submit">Ara</button>
      </form>

      {results.length > 0 && (
        <div className="card" style={{ padding: 0, marginBottom: 18 }}>
          {results.map((s) => (
            <Link
              key={s.setNum}
              href={`/pazar/yeni?set=${s.setNum}`}
              style={{
                display: "flex", justifyContent: "space-between", padding: "12px 16px",
                borderBottom: "1px solid var(--line)", fontSize: 14, color: "inherit",
              }}
            >
              <b>{s.name}</b>
              <span style={{ color: "var(--ink3)" }}>#{s.setNum.replace(/-1$/, "")} · {s.year}</span>
            </Link>
          ))}
        </div>
      )}
      {q && q.trim().length >= 2 && results.length === 0 && (
        <div className="notice" style={{ marginBottom: 18 }}>“{q}” için sonuç yok.</div>
      )}

      {mine.length > 0 && (
        <>
          <h2 style={{ fontFamily: "var(--disp)", fontSize: 16, fontWeight: 800, margin: "4px 0 10px" }}>
            Koleksiyonundan hızlı seçim
          </h2>
          <div className="card" style={{ padding: 0 }}>
            {mine.map((s) => (
              <Link
                key={s.setNum}
                href={`/pazar/yeni?set=${s.setNum}`}
                style={{
                  display: "flex", justifyContent: "space-between", padding: "12px 16px",
                  borderBottom: "1px solid var(--line)", fontSize: 14, color: "inherit",
                }}
              >
                <b>{s.name}</b>
                <span style={{ color: "var(--ink3)" }}>#{s.setNum.replace(/-1$/, "")}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
