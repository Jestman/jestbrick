import Link from "next/link";
import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { db, envReady, schema } from "@/db";
import { getUser } from "@/lib/supabase/server";
import { YeniBaslikForm } from "./YeniBaslikForm";

export const metadata = { title: "Yeni Başlık" };

export default async function YeniBaslikPage({
  searchParams,
}: {
  searchParams: Promise<{ k?: string }>;
}) {
  if (!envReady()) redirect("/");
  const user = await getUser();
  if (!user) redirect("/giris?sonra=/forum/yeni");

  const { k } = await searchParams;
  const categories = await db()
    .select({
      id: schema.forumCategories.id,
      name: schema.forumCategories.name,
      icon: schema.forumCategories.icon,
      slug: schema.forumCategories.slug,
    })
    .from(schema.forumCategories)
    .orderBy(asc(schema.forumCategories.position));

  const defaultCat = k ? categories.find((c) => c.slug === k) : undefined;

  return (
    <main className="wrap" style={{ maxWidth: 560 }}>
      <Link href="/forum" style={{ fontSize: 13.5, fontWeight: 600 }}>← Foruma dön</Link>
      <h1 className="page" style={{ marginTop: 10 }}>Yeni Başlık</h1>
      <YeniBaslikForm
        categories={categories.map(({ id, name, icon }) => ({ id, name, icon }))}
        defaultCategoryId={defaultCat?.id}
      />
    </main>
  );
}
