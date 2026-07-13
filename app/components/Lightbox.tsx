"use client";

import { useState } from "react";

/** Tıklayınca sayfa içinde büyüyen fotoğraf (yeni sekme yerine lightbox). */
export function ZoomImg({
  src,
  alt,
  style,
}: {
  src: string;
  alt: string;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src} alt={alt} loading="lazy"
        style={{ cursor: "zoom-in", ...style }}
        onClick={() => setOpen(true)}
      />
      {open && (
        <div
          role="dialog" aria-label={alt}
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 200, background: "rgba(18,20,27,0.88)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20, cursor: "zoom-out",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} style={{ maxWidth: "94vw", maxHeight: "92vh", borderRadius: 12 }} />
          <button
            type="button" aria-label="Kapat"
            style={{
              position: "absolute", top: 14, right: 18, background: "none", border: "none",
              color: "#fff", fontSize: 30, cursor: "pointer", lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
