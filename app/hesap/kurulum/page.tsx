"use client";

import { useActionState } from "react";
import { claimHandle } from "@/lib/auth/actions";

export default function KurulumPage() {
  const [state, action, pending] = useActionState(claimHandle, undefined);

  return (
    <main className="wrap" style={{ maxWidth: 440 }}>
      <h1 className="page">Profilini kur</h1>
      <p style={{ color: "var(--ink2)", marginBottom: 18, fontSize: 14 }}>
        Kullanıcı adın profil adresin olur: <code>jestbrick.com/u/kullaniciadi</code>
      </p>
      <div className="card">
        {state?.error && <div className="error">{state.error}</div>}
        <form action={action}>
          <div className="field">
            <label htmlFor="handle">Kullanıcı adı</label>
            <input
              id="handle"
              name="handle"
              placeholder="örn. tuglakolik"
              pattern="[a-z0-9_.]{3,24}"
              title="3-24 karakter: küçük harf, rakam, nokta, alt çizgi"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="displayName">Görünen ad</label>
            <input id="displayName" name="displayName" placeholder="örn. Ali Yıldız" />
          </div>
          <div className="field">
            <label htmlFor="city">Şehir (isteğe bağlı)</label>
            <input id="city" name="city" placeholder="örn. İstanbul" />
          </div>
          <button className="btn btn-y" style={{ width: "100%" }} disabled={pending}>
            {pending ? "Kaydediliyor…" : "Profili Oluştur"}
          </button>
        </form>
      </div>
    </main>
  );
}
