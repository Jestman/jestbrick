"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { quickAddSet, type QuickAddState } from "@/lib/collection/actions";

type LogItem = { setNum: string; name: string; already?: boolean };

/**
 * Seri ekleme modu: numara yaz → Enter → eklendi → kutu temizlenir,
 * odak kalır. Koleksiyon kurma süresini dakikalara indirir.
 */
export default function HizliEklePage() {
  const [state, action, pending] = useActionState<QuickAddState, FormData>(quickAddSet, undefined);
  const [log, setLog] = useState<LogItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastHandled = useRef<QuickAddState>(undefined);

  // her başarılı eklemede: listeye yaz, kutuyu temizle, odağı koru
  useEffect(() => {
    if (!state || state === lastHandled.current) return;
    lastHandled.current = state;
    if (state.ok) {
      setLog((l) => [{ setNum: state.setNum, name: state.name, already: state.already }, ...l]);
      if (inputRef.current) {
        inputRef.current.value = "";
        inputRef.current.focus();
      }
    } else if (inputRef.current) {
      inputRef.current.select();
    }
  }, [state]);

  return (
    <main className="wrap" style={{ maxWidth: 560 }}>
      <Link href="/koleksiyon" style={{ fontSize: 13.5, fontWeight: 600 }}>← Koleksiyonuma dön</Link>
      <h1 className="page" style={{ marginTop: 10 }}>⚡ Hızlı Ekleme</h1>
      <p style={{ fontSize: 14, color: "var(--ink2)", marginBottom: 16 }}>
        Elindeki setlerin numaralarını arka arkaya gir — her <b>Enter</b> bir set ekler.
        Numara kutunun ya da talimat kitapçığının üstünde yazar (örn. <b>10281</b>).
      </p>

      <form action={action} className="card" style={{ display: "flex", gap: 8, padding: 16 }}>
        <input
          ref={inputRef}
          name="setNum"
          inputMode="numeric"
          placeholder="Set numarası… (10281)"
          autoComplete="off"
          autoFocus
          required
          style={{
            flex: 1, padding: "12px 16px", border: "2px solid var(--yellow)", borderRadius: 12,
            fontSize: 18, fontFamily: "var(--disp)", fontWeight: 700, letterSpacing: 1,
          }}
        />
        <button className="btn btn-y" type="submit" disabled={pending} style={{ fontSize: 15 }}>
          {pending ? "…" : "Ekle ↵"}
        </button>
      </form>

      {state && !state.ok && (
        <div className="error" style={{ marginTop: 12 }}>{state.error}</div>
      )}

      {log.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <b style={{ fontFamily: "var(--disp)", fontSize: 14.5 }}>
            Bu oturumda eklenen: {log.filter((l) => !l.already).length}
          </b>
          <div className="card" style={{ padding: 0, marginTop: 8 }}>
            {log.map((l, i) => (
              <Link
                key={`${l.setNum}-${i}`}
                href={`/setler/${l.setNum}`}
                style={{
                  display: "flex", gap: 10, alignItems: "center", padding: "10px 14px",
                  borderBottom: "1px solid var(--line)", fontSize: 13.5, color: "inherit",
                }}
              >
                <span>{l.already ? "ℹ️" : "✅"}</span>
                <b style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {l.name}
                </b>
                <small style={{ color: "var(--ink3)" }}>
                  #{l.setNum.replace(/-1$/, "")}{l.already ? " · zaten vardı" : ""}
                </small>
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
