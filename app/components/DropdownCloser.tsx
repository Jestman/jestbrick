"use client";

import { useEffect } from "react";

/**
 * details.dd menülerini dış tıklamada, Escape'te ve menü içi bağlantıya
 * tıklayınca kapatır (Link istemci tarafında gezindiği için details açık kalıyordu).
 */
export function DropdownCloser() {
  useEffect(() => {
    const closeAll = (except?: Node) => {
      document.querySelectorAll<HTMLDetailsElement>("details.dd[open]").forEach((d) => {
        if (!except || !d.contains(except)) d.removeAttribute("open");
      });
    };
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      // menü içindeki bir bağlantıya tıklandıysa o menü de kapansın
      if (t.closest("details.dd") && t.closest("a")) closeAll();
      else closeAll(t);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll();
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  return null;
}
