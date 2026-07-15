"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PasswordInput } from "@/app/components/PasswordInput";

function YenileForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // E-postadaki bağlantı ?code= ile gelir; oturuma çevrilmeden şifre değişemez
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const code = params.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setError("Bağlantı geçersiz ya da süresi dolmuş — yeni bir sıfırlama isteği gönder.");
          return;
        }
      }
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setError("Bağlantı geçersiz ya da süresi dolmuş — yeni bir sıfırlama isteği gönder.");
        return;
      }
      setReady(true);
    })();
  }, [params]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const p1 = String(fd.get("password") ?? "");
    const p2 = String(fd.get("password2") ?? "");
    if (p1.length < 8) return setError("Şifre en az 8 karakter olmalı.");
    if (p1 !== p2) return setError("Şifreler eşleşmiyor.");
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: p1 });
    setPending(false);
    if (error) return setError("Şifre güncellenemedi — bağlantı süresi dolmuş olabilir.");
    router.replace("/?sifre=yenilendi");
  }

  return (
    <div className="card">
      {error && (
        <div className="error">
          {error}{" "}
          <a href="/sifre-sifirla" style={{ fontWeight: 700 }}>Yeni bağlantı iste →</a>
        </div>
      )}
      {ready && (
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="password">Yeni şifre</label>
            <PasswordInput id="password" name="password" minLength={8} autoComplete="new-password" />
          </div>
          <div className="field">
            <label htmlFor="password2">Yeni şifre (tekrar)</label>
            <PasswordInput id="password2" name="password2" minLength={8} autoComplete="new-password" />
          </div>
          <button className="btn btn-y" style={{ width: "100%" }} disabled={pending}>
            {pending ? "Kaydediliyor…" : "Şifreyi Güncelle"}
          </button>
        </form>
      )}
      {!ready && !error && <p style={{ color: "var(--ink3)", fontSize: 14 }}>Bağlantı doğrulanıyor…</p>}
    </div>
  );
}

export default function SifreYenilePage() {
  return (
    <main className="wrap" style={{ maxWidth: 440 }}>
      <h1 className="page">Yeni şifre belirle</h1>
      <Suspense fallback={null}>
        <YenileForm />
      </Suspense>
    </main>
  );
}
