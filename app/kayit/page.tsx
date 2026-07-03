"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp } from "@/lib/auth/actions";

export default function KayitPage() {
  const [state, action, pending] = useActionState(signUp, undefined);

  return (
    <main className="wrap" style={{ maxWidth: 440 }}>
      <h1 className="page">Aramıza katıl</h1>
      <div className="card">
        {state?.error && <div className="error">{state.error}</div>}
        <form action={action}>
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
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              placeholder="en az 8 karakter"
              required
            />
          </div>
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
