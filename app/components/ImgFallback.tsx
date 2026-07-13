"use client";

import { useEffect } from "react";

/**
 * Site geneli kırık görsel sigortası: yüklenemeyen her <img>
 * yerine tuğla yer tutucusu koyar (CDN'den kalkan katalog görselleri için).
 */
export function ImgFallback() {
  useEffect(() => {
    // NOT: SVG-görsel içinde emoji render olmaz — tuğla çizimle
    const PLACEHOLDER =
      "data:image/svg+xml," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
          <rect width="100" height="100" fill="#f5f6f8"/>
          <rect x="26" y="30" width="20" height="14" rx="3" fill="#F5C518" stroke="#d9dce3"/>
          <rect x="54" y="30" width="20" height="14" rx="3" fill="#F5C518" stroke="#d9dce3"/>
          <rect x="18" y="42" width="64" height="28" rx="6" fill="#F5C518" stroke="#d9dce3"/>
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
