import Link from "next/link";
import { Fragment } from "react";

const URL_RE = /(https?:\/\/[^\s<>"']+)/g;
const SET_RE = /(^|\s)#(\d{4,7})(?=[\s.,!?)]|$)/g;

/**
 * Forum/paylaşım gövdesi: satır sonları korunur, URL'ler tıklanabilir olur,
 * #10281 gibi set numaraları katalog sayfasına bağlanır. (XSS güvenli:
 * HTML üretmez, React düğümleri döndürür.)
 */
export function RichBody({ text, style }: { text: string; style?: React.CSSProperties }) {
  const parts: React.ReactNode[] = [];
  let key = 0;

  // önce set numaralarını işaretle (URL'lerin içine dokunmadan basit yaklaşım:
  // URL parçalama önce, set bağlama URL olmayan dilimlerde)
  for (const chunk of text.split(URL_RE)) {
    // split(URL_RE) yakalama grubu URL dilimlerini ayrı döndürür
    if (chunk.startsWith("http://") || chunk.startsWith("https://")) {
      parts.push(
        <a key={key++} href={chunk} target="_blank" rel="noopener nofollow ugc" style={{ wordBreak: "break-all" }}>
          {chunk}
        </a>
      );
      continue;
    }
    // set numarası bağlama
    let last = 0;
    for (const m of chunk.matchAll(SET_RE)) {
      const idx = (m.index ?? 0) + m[1].length;
      if (idx > last) parts.push(<Fragment key={key++}>{chunk.slice(last, idx)}</Fragment>);
      parts.push(
        <Link key={key++} href={`/setler/${m[2]}-1`} style={{ fontWeight: 700 }}>
          #{m[2]}
        </Link>
      );
      last = idx + m[2].length + 1;
    }
    if (last < chunk.length) parts.push(<Fragment key={key++}>{chunk.slice(last)}</Fragment>);
  }

  return <p style={{ whiteSpace: "pre-wrap", ...style }}>{parts}</p>;
}
