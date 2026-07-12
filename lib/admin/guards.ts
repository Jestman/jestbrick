import "server-only";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getUser } from "@/lib/supabase/server";

export type Role = (typeof schema.userRole.enumValues)[number];

/** Girişli kullanıcının rolünü döndürür (girişsizse null). */
export async function currentRole(): Promise<{ userId: string; role: Role } | null> {
  const user = await getUser();
  if (!user) return null;
  const [row] = await db()
    .select({ role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.id, user.id));
  return row ? { userId: user.id, role: row.role } : null;
}

export function isModerator(role: Role) {
  return role === "moderator" || role === "staff";
}

/** Moderatör veya staff şart — değilse ana sayfaya. */
export async function requireModerator() {
  const me = await currentRole();
  if (!me || !isModerator(me.role)) redirect("/");
  return me;
}

/** Sadece staff (rol atama, site ayarları). */
export async function requireStaff() {
  const me = await currentRole();
  if (!me || me.role !== "staff") redirect("/");
  return me;
}
