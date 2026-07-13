"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/lib/auth/actions";

export default function SifreSifirlaPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);

  return (
    <main className="wrap" style={{ maxWidth: 440 }}>
      <h1 className="page">Şifreni sıfırla</h1>
      <div className="card">
        {state?.ok ? (
          <div className="notice">
            📮 Eğer bu adrese kayıtlı bir hesap varsa sıfırlama bağlantısı gönderildi.
            Gelen kutunu (ve spam klasörünü) kontrol et.
          </div>
        ) : (
          <form action={action}>
            <p style={{ fontSize: 14, color: "var(--ink2)", marginBottom: 14 }}>
              E-posta adresini gir; sana yeni şifre belirleme bağlantısı gönderelim.
            </p>
            {state?.error && <div className="error">{state.error}</div>}
            <div className="field">
              <label htmlFor="email">E-posta</label>
              <input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <button className="btn btn-y" style={{ width: "100%" }} disabled={pending}>
              {pending ? "Gönderiliyor…" : "Sıfırlama Bağlantısı Gönder"}
            </button>
          </form>
        )}
        <p style={{ fontSize: 13.5, marginTop: 14, textAlign: "center" }}>
          <Link href="/giris" style={{ fontWeight: 600 }}>← Girişe dön</Link>
        </p>
      </div>
    </main>
  );
}
