"use client";

import { useActionState } from "react";
import { updateProfile } from "@/lib/auth/actions";

export function ProfilForm({
  defaults,
}: {
  defaults: {
    handle: string;
    displayName: string;
    bio: string;
    city: string;
    wishlistPublic: boolean;
    profilePublic: boolean;
  };
}) {
  const [state, action, pending] = useActionState(updateProfile, undefined);

  return (
    <div className="card">
      {state?.error && <div className="error">{state.error}</div>}
      <form action={action}>
        <div className="field">
          <label htmlFor="handle">Kullanıcı adı</label>
          <input
            id="handle"
            name="handle"
            defaultValue={defaults.handle}
            pattern="[a-z0-9_.]{3,24}"
            title="3-24 karakter: küçük harf, rakam, nokta, alt çizgi"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="displayName">Görünen ad</label>
          <input id="displayName" name="displayName" defaultValue={defaults.displayName} maxLength={60} />
        </div>
        <div className="field">
          <label htmlFor="bio">Hakkında</label>
          <textarea
            id="bio"
            name="bio"
            defaultValue={defaults.bio}
            maxLength={300}
            rows={3}
            placeholder="Kendini LEGO dünyasına tanıt…"
            style={{
              width: "100%", border: "1.5px solid var(--line)", borderRadius: 10,
              padding: "10px 13px", outline: "none", resize: "vertical",
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="city">Şehir</label>
          <input id="city" name="city" defaultValue={defaults.city} maxLength={60} />
        </div>
        <div className="field">
          <label htmlFor="avatar">Profil fotoğrafı (en fazla 4MB)</label>
          <input id="avatar" name="avatar" type="file" accept="image/*" style={{ border: "none", padding: 0 }} />
        </div>
        <label style={{ display: "flex", gap: 9, alignItems: "center", fontSize: 14, marginBottom: 10, cursor: "pointer" }}>
          <input type="checkbox" name="wishlistPublic" defaultChecked={defaults.wishlistPublic} />
          İstek listem profilimde görünsün (eşleştirme önerileri için gerekli)
        </label>
        <label style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 14, marginBottom: 16, cursor: "pointer" }}>
          <input type="checkbox" name="profilePublic" defaultChecked={defaults.profilePublic} style={{ marginTop: 3 }} />
          <span>
            Herkese açık profil — üye olmayanlar da linkle koleksiyonumu görebilsin
            <small style={{ display: "block", color: "var(--ink3)", marginTop: 2 }}>
              Kapatırsan vitrinin yalnızca JestBrick üyelerine görünür.
            </small>
          </span>
        </label>
        <button className="btn btn-y" style={{ width: "100%" }} disabled={pending}>
          {pending ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </form>
    </div>
  );
}
