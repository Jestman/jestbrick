"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Item = { setNum: string; name: string; year: number; img: string | null };

/**
 * Canlı set arama kutusu: 2+ karakterde önerileri getirir (250 ms debounce).
 * Sayı yazınca numara önekiyle, metin yazınca adla eşleşir; Enter tam aramaya gider.
 */
export function SearchBox({ className }: { className?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // debounce'lu öneri getirme
  useEffect(() => {
    if (q.trim().length < 2) {
      setItems([]);
      setOpen(false);
      return;
    }
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(`/api/ara?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal });
        const data = (await res.json()) as { items: Item[] };
        setItems(data.items);
        setOpen(data.items.length > 0);
        setActive(-1);
      } catch {
        /* iptal/ağ hatası: sessiz */
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  // dışarı tıklayınca kapan
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function submit() {
    if (active >= 0 && items[active]) {
      router.push(`/setler/${items[active].setNum}`);
    } else if (q.trim()) {
      router.push(`/setler?q=${encodeURIComponent(q.trim())}`);
    }
    setOpen(false);
  }

  return (
    <div ref={boxRef} className={className} style={{ position: "relative" }}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => items.length > 0 && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); submit(); }
          else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)); }
          else if (e.key === "Escape") setOpen(false);
        }}
        placeholder="🔍 Set ara… (ad ya da numara)"
        autoComplete="off"
        aria-label="Set ara"
        role="combobox"
        aria-expanded={open}
      />
      {open && (
        <div className="search-suggest" role="listbox">
          {items.map((it, i) => (
            <Link
              key={it.setNum}
              href={`/setler/${it.setNum}`}
              className="search-suggest-row"
              role="option"
              aria-selected={i === active}
              style={i === active ? { background: "var(--yellow-soft)" } : undefined}
              onClick={() => setOpen(false)}
              onMouseEnter={() => setActive(i)}
            >
              {it.img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.img} alt="" width={42} height={32} style={{ objectFit: "contain", flex: "none", background: "#fff", borderRadius: 6 }} />
              ) : (
                <span style={{ fontSize: 20, flex: "none" }}>🧱</span>
              )}
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {it.name}
              </span>
              <small style={{ color: "var(--ink3)", flex: "none" }}>
                #{it.setNum.replace(/-1$/, "")} · {it.year}
              </small>
            </Link>
          ))}
          <button type="button" className="search-suggest-row" style={{ width: "100%", background: "none", border: "none", fontWeight: 700, fontSize: 13, justifyContent: "center" }} onClick={submit}>
            “{q}” için tüm sonuçlar →
          </button>
        </div>
      )}
    </div>
  );
}
