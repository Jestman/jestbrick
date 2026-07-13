"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Mobil menü kabuğu: içerik sunucuda render edilir (rozetler dahil),
 * aç/kapa durumu istemcide tutulur; sayfa değişince menü kapanır.
 */
export function NavShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <button
        type="button"
        className="nav-burger"
        aria-label="Menüyü aç/kapat"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "✕" : "☰"}
      </button>
      <nav className={open ? "nav-open" : undefined}>{children}</nav>
    </>
  );
}
