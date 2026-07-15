"use client";

import { useActionState, useState } from "react";
import { deleteAccount } from "@/lib/auth/actions";

/** Tehlikeli bölge: yazılı onaylı kalıcı hesap silme. */
export function HesapSil({ handle }: { handle: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(deleteAccount, undefined);

  return (
    <div className="card" style={{ marginTop: 22, borderLeft: "5px solid var(--red)" }}>
      <b style={{ fontFamily: "var(--disp)", fontSize: 15 }}>Tehlikeli bölge</b>
      <p style={{ fontSize: 13, color: "var(--ink2)", margin: "6px 0 12px" }}>
        Hesabını kalıcı olarak silersen koleksiyonun, ilanların, mesajların ve forum yazıların
        geri getirilemez şekilde silinir.
      </p>
      {!open ? (
        <button type="button" className="btn btn-o" style={{ color: "var(--red)", fontSize: 13 }} onClick={() => setOpen(true)}>
          Hesabımı silmek istiyorum
        </button>
      ) : (
        <form action={action} style={{ display: "grid", gap: 10 }}>
          {state?.error && <div className="error">{state.error}</div>}
          <label style={{ fontSize: 13 }}>
            Onaylamak için kullanıcı adını yaz: <b>{handle}</b>
            <input
              name="onay" autoComplete="off" placeholder={handle}
              style={{ width: "100%", marginTop: 5, padding: "9px 12px", border: "1.5px solid var(--red)", borderRadius: 10 }}
            />
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="submit" disabled={pending}
              className="btn" style={{ background: "var(--red)", color: "#fff", fontSize: 13 }}
            >
              {pending ? "Siliniyor…" : "Hesabı Kalıcı Olarak Sil"}
            </button>
            <button type="button" className="btn btn-o" style={{ fontSize: 13 }} onClick={() => setOpen(false)}>
              Vazgeç
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
