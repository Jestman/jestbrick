"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { signUp } from "@/lib/auth/actions";
import { PasswordInput } from "@/app/components/PasswordInput";

export default function KayitPage() {
  const [state, action, pending] = useActionState(signUp, undefined);
  // bot koruması: formun açılış anı (sunucu 3 sn altındaki gönderimi reddeder)
  const [ft, setFt] = useState("");
  useEffect(() => setFt(String(Date.now())), []);

  return (
    <main className="wrap" style={{ maxWidth: 440 }}>
      <h1 className="page">Aramıza katıl</h1>
      <div className="card">
        {state?.error && <div className="error">{state.error}</div>}
        <form action={action}>
          <input type="hidden" name="ft" value={ft} />
          {/* tuzak alan: insanlar görmez, botlar doldurur */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }}
          />
          <div className="field">
            <label htmlFor="displayName">Görünen ad</label>
            <input id="displayName" name="displayName" placeholder="örn. Ali Yıldız" required />
          </div>
          <div className="field">
            <label htmlFor="email">E-posta</label>
            <input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">Şifre</label>
            <PasswordInput id="password" autoComplete="new-password" minLength={8} placeholder="en az 8 karakter" />
          </div>
          <label style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 13, marginBottom: 14, cursor: "pointer", lineHeight: 1.5 }}>
            <input type="checkbox" name="terms" required style={{ marginTop: 3 }} />
            <span>
              <Link href="/kurallar" target="_blank">Kurallar &amp; Kullanım Şartları</Link>'nı ve{" "}
              <Link href="/gizlilik" target="_blank">Gizlilik Politikası</Link>'nı okudum, kabul ediyorum.
            </span>
          </label>
          <button className="btn btn-y" style={{ width: "100%" }} disabled={pending}>
            {pending ? "Kaydediliyor…" : "Hesap Oluştur"}
          </button>
        </form>
        <p style={{ marginTop: 14, fontSize: 13.5, color: "var(--ink2)" }}>
          Zaten üye misin? <Link href="/giris">Giriş yap</Link>
        </p>
      </div>
    </main>
  );
}
