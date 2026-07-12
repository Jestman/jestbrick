"use client";

import { useActionState } from "react";
import { createListing, type ListingFormState } from "@/lib/market/actions";

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 13px", border: "1.5px solid var(--line)",
  borderRadius: 10, fontSize: 14, fontFamily: "inherit", background: "#fff",
};

export function YeniIlanForm({
  setNum,
  setName,
  defaultCity,
}: {
  setNum: string;
  setName: string;
  defaultCity: string | null;
}) {
  const [state, action, pending] = useActionState<ListingFormState, FormData>(
    createListing,
    undefined
  );

  return (
    <form action={action} className="card" style={{ padding: 22, display: "grid", gap: 14 }}>
      <input type="hidden" name="setNum" value={setNum} />
      <div style={{ fontSize: 14 }}>
        Satılan set: <b>{setName}</b>{" "}
        <span style={{ color: "var(--ink3)" }}>#{setNum.replace(/-1$/, "")}</span>
      </div>

      <label style={{ fontSize: 13.5, fontWeight: 700 }}>
        Fiyat (₺)
        <input
          name="price" type="number" min={1} max={1_000_000} required
          placeholder="ör. 4500" style={{ ...inputStyle, marginTop: 5 }}
        />
      </label>

      <label style={{ fontSize: 13.5, fontWeight: 700 }}>
        Durum
        <select name="condition" required style={{ ...inputStyle, marginTop: 5 }} defaultValue="complete">
          <option value="sealed">Kapalı kutu (hiç açılmamış)</option>
          <option value="complete">Eksiksiz (açık, tüm parçalar + talimat)</option>
          <option value="used">Kullanılmış (eksik olabilir, açıklamaya yaz)</option>
        </select>
      </label>

      <label style={{ fontSize: 13.5, fontWeight: 700 }}>
        Açıklama
        <textarea
          name="description" rows={4} maxLength={2000}
          placeholder="Kutu/talimat durumu, eksikler, takas tercihi…"
          style={{ ...inputStyle, marginTop: 5, resize: "vertical" }}
        />
      </label>

      <label style={{ fontSize: 13.5, fontWeight: 700 }}>
        Fotoğraflar <span style={{ fontWeight: 400, color: "var(--ink3)" }}>(en fazla 4 · isteğe bağlı)</span>
        <input
          name="photos" type="file" accept="image/*" multiple
          style={{ ...inputStyle, marginTop: 5, padding: "8px 10px" }}
        />
      </label>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <label style={{ fontSize: 13.5, fontWeight: 700, flex: 1, minWidth: 180 }}>
          Şehir
          <input
            name="city" defaultValue={defaultCity ?? ""} placeholder="ör. İstanbul"
            style={{ ...inputStyle, marginTop: 5 }}
          />
        </label>
        <label style={{ fontSize: 13.5, display: "flex", alignItems: "center", gap: 8, marginTop: 18 }}>
          <input type="checkbox" name="ships" defaultChecked style={{ width: 17, height: 17 }} />
          Kargoyla gönderebilirim
        </label>
      </div>

      {state?.error && (
        <div className="notice" style={{ borderColor: "var(--red)", color: "var(--red)" }}>
          {state.error}
        </div>
      )}

      <button className="btn btn-y" type="submit" disabled={pending} style={{ justifySelf: "start" }}>
        {pending ? "Yayınlanıyor…" : "🏷️ İlanı Yayınla"}
      </button>
      <p style={{ fontSize: 12.5, color: "var(--ink3)", margin: 0 }}>
        Yayınlanınca bu seti istek listesine ekleyip bildirimi açık tutan üyelere otomatik haber gider.
      </p>
    </form>
  );
}
