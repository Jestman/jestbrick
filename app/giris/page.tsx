"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { signIn } from "@/lib/auth/actions";

function GirisForm() {
  const [state, action, pending] = useActionState(signIn, undefined);
  const params = useSearchParams();
  const sonra = params.get("sonra") ?? "";

  return (
    <div className="card">
      {state?.error && <div className="error">{state.error}</div>}
      <form action={action}>
        <input type="hidden" name="sonra" value={sonra} />
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
            autoComplete="current-password"
            required
          />
        </div>
        <button className="btn btn-y" style={{ width: "100%" }} disabled={pending}>
          {pending ? "Giriş yapılıyor…" : "Giriş Yap"}
        </button>
      </form>
      <p style={{ marginTop: 14, fontSize: 13.5, color: "var(--ink2)", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
        <span>
          Hesabın yok mu? <Link href="/kayit">Katıl</Link>
        </span>
        <Link href="/sifre-sifirla">Şifremi unuttum</Link>
      </p>
    </div>
  );
}

export default function GirisPage() {
  return (
    <main className="wrap" style={{ maxWidth: 440 }}>
      <h1 className="page">Giriş yap</h1>
      <Suspense fallback={null}>
        <GirisForm />
      </Suspense>
    </main>
  );
}
