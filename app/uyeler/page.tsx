import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { db, envReady, schema } from "@/db";
import { getUser } from "@/lib/supabase/server";
import { follow, unfollow } from "@/lib/social/actions";
import { Avatar, RoleBadge } from "@/app/components/Avatar";
import { mediaUrl } from "@/lib/media";

export const metadata = { title: "Üyeler" };

export default async function UyelerPage() {
  if (!envReady()) redirect("/");
  const viewer = await getUser();

  const members = await db()
    .select({
      id: schema.users.id,
      handle: schema.users.handle,
      displayName: schema.users.displayName,
      role: schema.users.role,
      city: schema.users.city,
      bio: schema.users.bio,
      avatarPath: schema.users.avatarPath,
      // NOT: alt sorguda ${schema.users.id} niteliksiz "id" basar ve alt
      // sorgunun tablosuna çözülür — elle nitele (bilinen drizzle tuzağı).
      setCount: sql<number>`(
        select count(*)::int from collection_items ci where ci.user_id = users.id
      )`,
      followerCount: sql<number>`(
        select count(*)::int from follows f where f.followee_id = users.id
      )`,
      followedByMe: viewer
        ? sql<boolean>`exists (
            select 1 from follows f
            where f.follower_id = ${viewer.id} and f.followee_id = ${schema.users.id}
          )`
        : sql<boolean>`false`,
    })
    .from(schema.users)
    .orderBy(desc(schema.users.createdAt))
    .limit(60);

  return (
    <main className="wrap" style={{ maxWidth: 820 }}>
      <h1 className="page">Üyeler</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {members.map((m) => (
          <div key={m.id} className="card" style={{ display: "flex", gap: 14, alignItems: "center", padding: "14px 18px" }}>
            <Link href={`/u/${m.handle}`}>
              <Avatar handle={m.handle} name={m.displayName} size={48} src={mediaUrl(m.avatarPath)} />
            </Link>
            <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
              <div style={{ fontWeight: 700, fontSize: 14.5, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <Link href={`/u/${m.handle}`} style={{ color: "inherit" }}>
                  {m.displayName || m.handle}
                </Link>
                <RoleBadge role={m.role} />
              </div>
              <div style={{ fontSize: 12.5, color: "var(--ink3)" }}>
                @{m.handle}
                {m.city ? ` · ${m.city}` : ""} · {m.setCount} set · {m.followerCount} takipçi
              </div>
              {m.bio && (
                <div style={{ fontSize: 13, color: "var(--ink2)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {m.bio}
                </div>
              )}
            </div>
            {viewer && viewer.id !== m.id && (
              m.followedByMe ? (
                <form action={unfollow}>
                  <input type="hidden" name="userId" value={m.id} />
                  <input type="hidden" name="back" value="/uyeler" />
                  <button className="btn btn-o" type="submit" style={{ padding: "7px 14px", fontSize: 13 }}>
                    Takiptesin ✓
                  </button>
                </form>
              ) : (
                <form action={follow}>
                  <input type="hidden" name="userId" value={m.id} />
                  <input type="hidden" name="back" value="/uyeler" />
                  <button className="btn btn-y" type="submit" style={{ padding: "7px 14px", fontSize: 13 }}>
                    Takip Et
                  </button>
                </form>
              )
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
