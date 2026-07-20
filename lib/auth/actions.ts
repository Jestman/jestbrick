"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { db, schema } from "@/db";
import { flagEnabled } from "@/lib/settings";
import { clientIp, rateLimit, RATE_MSG } from "@/lib/rate-limit";

export type AuthState = { error?: string } | undefined;

const HANDLE_RE = /^[a-z0-9_.]{3,24}$/;

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();

  // Bot koruması: gizli tuzak alanı dolduysa ya da form insanüstü hızda
  // gönderildiyse (3 sn altı) gerçek sebep söylenmeden reddedilir.
  const honeypot = String(formData.get("website") ?? "");
  const startedAt = Number(formData.get("ft"));
  const elapsed = Date.now() - startedAt;
  if (honeypot || !Number.isFinite(startedAt) || elapsed < 3000 || elapsed > 86_400_000) {
    return { error: "Bir şeyler ters gitti — sayfayı yenileyip tekrar dene." };
  }
  if (!(await rateLimit(`kayit:${await clientIp()}`, 5, 3600))) {
    return { error: RATE_MSG };
  }

  if (!email || password.length < 8) {
    return { error: "Geçerli bir e-posta ve en az 8 karakterli bir şifre gerekli." };
  }
  if (!(await flagEnabled("signup_enabled"))) {
    return { error: "Yeni kayıtlar şu an geçici olarak kapalı. Daha sonra tekrar dene." };
  }
  if (formData.get("terms") !== "on") {
    return { error: "Devam etmek için Kurallar'ı ve Gizlilik Politikası'nı kabul etmelisin." };
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

  // Şifre deneme saldırısına karşı IP başına limit
  if (!(await rateLimit(`giris:${await clientIp()}`, 20, 900))) {
    return { error: RATE_MSG };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "E-posta veya şifre hatalı." };
  }

  // askıya alınmış hesap giremez
  if (data.user) {
    const [row] = await db()
      .select({ bannedAt: schema.users.bannedAt })
      .from(schema.users)
      .where(eq(schema.users.id, data.user.id));
    if (row?.bannedAt) {
      await supabase.auth.signOut();
      return { error: "Bu hesap askıya alınmış. İtiraz için iletişim sayfasına bak." };
    }
  }

  redirect(after);
}

/** Şifre sıfırlama e-postası ister; hesap yoksa da başarı der (enumeration koruması). */
export async function requestPasswordReset(
  _prev: (AuthState & { ok?: boolean }) | undefined,
  formData: FormData
): Promise<AuthState & { ok?: boolean }> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email.includes("@")) return { error: "Geçerli bir e-posta gir." };
  if (!(await rateLimit(`sifre:${await clientIp()}`, 5, 900))) {
    return { error: RATE_MSG };
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: "https://jestbrick.com/sifre-yenile",
  });
  return { ok: true };
}

/**
 * Hesabı kalıcı siler: auth.users kaydı silinir, FK zinciri tüm içerikleri
 * (koleksiyon, ilanlar, mesajlar, forum) beraberinde götürür.
 * Onay: kullanıcı kendi kullanıcı adını yazmalı.
 */
export async function deleteAccount(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris");

  const [me] = await db()
    .select({ handle: schema.users.handle })
    .from(schema.users)
    .where(eq(schema.users.id, user.id));
  const typed = String(formData.get("onay") ?? "").trim().toLowerCase();
  if (!me || typed !== me.handle) {
    return { error: `Onay için kullanıcı adını (${me?.handle}) aynen yazmalısın.` };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { error: "Hesap silinemedi — lütfen tekrar dene." };
  // Not: Storage'daki avatar/fotoğraf dosyaları yetim kalır; kişisel veri
  // içermeyen medya dosyalarıdır, periyodik temizlik launch sonrası eklenecek.

  await supabase.auth.signOut();
  redirect("/?hesap=silindi");
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
  const profilePublic = formData.get("profilePublic") === "on";

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
      profilePublic,
      ...(avatarPath ? { avatarPath } : {}),
    })
    .where(eq(schema.users.id, user.id));

  revalidatePath("/", "layout");
  redirect(`/u/${handle}`);
}
