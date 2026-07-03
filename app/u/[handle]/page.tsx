import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, envReady, schema } from "@/db";

export default async function ProfilPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  if (!envReady()) notFound();

  const rows = await db()
    .select()
    .from(schema.users)
    .where(eq(schema.users.handle, handle.toLowerCase()))
    .limit(1);

  const u = rows[0];
  if (!u) notFound();

  const roleBadge =
    u.role === "creator" ? (
      <span
        style={{
          background: "var(--yellow)",
          fontSize: 10.5,
          fontWeight: 800,
          padding: "2px 8px",
          borderRadius: 99,
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        ★ İçerik Üreticisi
      </span>
    ) : null;

  return (
    <main className="wrap" style={{ maxWidth: 720 }}>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div
          style={{
            height: 110,
            background: "linear-gradient(120deg, var(--ink), #3A4160)",
          }}
        />
        <div style={{ padding: "0 24px 22px" }}>
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: "50%",
              background: "var(--yellow)",
              marginTop: -42,
              border: "4px solid #fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
            }}
          >
            🙂
          </div>
          <h1
            style={{
              fontFamily: "var(--disp)",
              fontSize: 22,
              fontWeight: 800,
              marginTop: 12,
              display: "flex",
              alignItems: "center",
              gap: 9,
              flexWrap: "wrap",
            }}
          >
            {u.displayName || u.handle} {roleBadge}
          </h1>
          <p style={{ color: "var(--ink3)", fontSize: 14 }}>
            @{u.handle}
            {u.city ? ` · ${u.city}` : ""}
          </p>
          {u.bio && <p style={{ marginTop: 10, maxWidth: "60ch" }}>{u.bio}</p>}
          <div className="notice" style={{ marginTop: 18 }}>
            Koleksiyon vitrini, istek listesi ve takip <b>Faz 1</b>’de bu sayfaya geliyor.
          </div>
        </div>
      </div>
    </main>
  );
}
