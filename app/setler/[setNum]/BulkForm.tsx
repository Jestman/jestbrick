"use client";

import { useActionState } from "react";
import { bulkMatchMessage } from "@/lib/matching/actions";

export function BulkForm({ setNum, count }: { setNum: string; count: number }) {
  const [state, action, pending] = useActionState(bulkMatchMessage, undefined);

  return (
    <div style={{ marginTop: 12 }}>
      {state?.error && <div className="error">{state.error}</div>}
      {state?.ok && (
        <div style={{
          background: "#E8F5EE", color: "var(--green)", borderRadius: 10,
          padding: "10px 14px", fontSize: 13.5, fontWeight: 600, marginBottom: 10,
        }}>
          {state.ok}
        </div>
      )}
      {!state?.ok && (
        <form action={action}>
          <input type="hidden" name="setNum" value={setNum} />
          <button className="btn btn-y" style={{ width: "100%" }} disabled={pending}>
            {pending ? "Gönderiliyor…" : `📨 Hepsine "elimde var" mesajı gönder (${count} kişi)`}
          </button>
          <p style={{ fontSize: 12, color: "var(--ink3)", marginTop: 6, textAlign: "center" }}>
            Eşleştirme mesajı olarak iletilir · spam koruması: günde 1 toplu gönderim
          </p>
        </form>
      )}
    </div>
  );
}
