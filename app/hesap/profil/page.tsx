import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, envReady, schema } from "@/db";
import { getUser } from "@/lib/supabase/server";
import { Avatar } from "@/app/components/Avatar";
import { mediaUrl } from "@/lib/media";
import { ProfilForm } from "./ProfilForm";

export const metadata = { title: "Profili Düzenle" };

export default async function ProfilDuzenlePage() {
  if (!envReady()) redirect("/");
  const user = await getUser();
  if (!user) redirect("/giris?sonra=/hesap/profil");

  const rows = await db().select().from(schema.users).where(eq(schema.users.id, user.id)).limit(1);
  const u = rows[0];
  if (!u) redirect("/hesap/kurulum");

  return (
    <main className="wrap" style={{ maxWidth: 520 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
        <Avatar handle={u.handle} name={u.displayName} size={56} src={mediaUrl(u.avatarPath)} />
        <div>
          <h1 className="page" style={{ marginBottom: 0 }}>Profili Düzenle</h1>
          <span style={{ fontSize: 13, color: "var(--ink3)" }}>@{u.handle}</span>
        </div>
      </div>
      <ProfilForm
        defaults={{
          handle: u.handle,
          displayName: u.displayName,
          bio: u.bio,
          city: u.city ?? "",
          wishlistPublic: u.wishlistPublic,
        }}
      />
    </main>
  );
}
