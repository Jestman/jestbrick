"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { db, schema } from "@/db";
import { flagEnabled } from "@/lib/settings";

export type AuthState = { error?: string } | undefined;

const HANDLE_RE = /^[a-z0-9_.]{3,24}$/;

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();

  if (!email || password.length < 8) {
    return { error: "Geçerli bir e-posta ve en az 8 karakterli bir şifre gerekli." };
  }
  if (!(await flagEnabled("signup_enabled"))) {
    return { error: "Yeni kayıtlar şu an geçici olarak kapalı. Daha sonra tekrar dene." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });

  if (error) {
    return { error: error.message === "User already registered"
      ? "Bu e-posta ile zaten bir hesap var — giriş yapmayı dene."
      : error.message };
  }

  redirect("/hesap/kurulum");
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const after = String(formData.get("sonra") ?? "") || "/";

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "E-posta veya şifre hatalı." };
  }

  redirect(after);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

/** Kayıt sonrası kullanıcı adı seçimi (hesap kurulumu). */
export async function claimHandle(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const handle = String(formData.get("handle") ?? "").trim().toLowerCase();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();

  if (!HANDLE_RE.test(handle)) {
    return { error: "Kullanıcı adı 3-24 karakter olmalı; küçük harf, rakam, nokta ve alt çizgi kullanılabilir." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris");

  const taken = await db()
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.handle, handle))
    .limit(1);

  if (taken.length > 0 && taken[0].id !== user.id) {
    return { error: `@${handle} alınmış — başka bir tane dene.` };
  }

  await db()
    .update(schema.users)
    .set({
      handle,
      displayName: displayName || handle,
      city: city || null,
    })
    .where(eq(schema.users.id, user.id));

  revalidatePath("/", "layout");
  redirect(`/u/${handle}`);
}

/** Profil düzenleme: ad, bio, şehir, gizlilik + avatar yükleme. */
export async function updateProfile(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris");

  const handle = String(formData.get("handle") ?? "").trim().toLowerCase();
  const displayName = String(formData.get("displayName") ?? "").trim().slice(0, 60);
  const bio = String(formData.get("bio") ?? "").trim().slice(0, 300);
  const city = String(formData.get("city") ?? "").trim().slice(0, 60);
  const wishlistPublic = formData.get("wishlistPublic") === "on";

  if (!HANDLE_RE.test(handle)) {
    return { error: "Kullanıcı adı 3-24 karakter olmalı; küçük harf, rakam, nokta ve alt çizgi." };
  }
  const taken = await db()
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.handle, handle))
    .limit(1);
  if (taken.length > 0 && taken[0].id !== user.id) {
    return { error: `@${handle} alınmış — başka bir tane dene.` };
  }

  let avatarPath: string | undefined;
  const avatar = formData.get("avatar");
  if (avatar instanceof File && avatar.size > 0) {
    if (!avatar.type.startsWith("image/")) return { error: "Avatar bir görsel dosyası olmalı." };
    if (avatar.size > 4 * 1024 * 1024) return { error: "Avatar en fazla 4MB olabilir." };
    const ext = (avatar.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const path = `avatars/${user.id}.${ext}`;
    const admin = createAdminClient();
    const { error } = await admin.storage
      .from("media")
      .upload(path, Buffer.from(await avatar.arrayBuffer()), {
        contentType: avatar.type,
        upsert: true,
      });
    if (error) return { error: "Avatar yüklenemedi, tekrar dene." };
    avatarPath = path;
  }

  await db()
    .update(schema.users)
    .set({
      handle,
      displayName,
      bio,
      city: city || null,
      wishlistPublic,
      ...(avatarPath ? { avatarPath } : {}),
    })
    .where(eq(schema.users.id, user.id));

  revalidatePath("/", "layout");
  redirect(`/u/${handle}`);
}
