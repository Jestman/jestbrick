"use client";

import { useEffect } from "react";

/**
 * Site geneli kırık görsel sigortası: yüklenemeyen her <img>
 * yerine tuğla yer tutucusu koyar (CDN'den kalkan katalog görselleri için).
 */
export function ImgFallback() {
  useEffect(() => {
    const PLACEHOLDER =
      "data:image/svg+xml," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
          <rect width="100" height="100" fill="#f5f6f8"/>
          <text x="50" y="58" font-size="40" text-anchor="middle">🧱</text>
        </svg>`
      );
    const onError = (e: Event) => {
      const el = e.target as HTMLElement;
      if (el.tagName === "IMG" && (el as HTMLImageElement).src !== PLACEHOLDER) {
        (el as HTMLImageElement).src = PLACEHOLDER;
      }
    };
    // capture: true — img error olayları kabarcıklanmaz, yakalama şart
    document.addEventListener("error", onError, true);
    return () => document.removeEventListener("error", onError, true);
  }, []);
  return null;
}
