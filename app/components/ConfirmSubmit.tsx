"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

/**
 * Yıkıcı işlemler için iki aşamalı gönderim: ilk tık "Emin misin?" der,
 * 3,5 sn içinde ikinci tık formu gönderir; süre dolarsa eski haline döner.
 */
export function ConfirmSubmit({
  children,
  confirmText = "Emin misin?",
  className = "btn btn-o",
  style,
  title,
}: {
  children: React.ReactNode;
  confirmText?: string;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}) {
  const [armed, setArmed] = useState(false);
  const { pending } = useFormStatus();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (!armed) {
    return (
      <button
        type="button"
        className={className}
        style={style}
        title={title}
        onClick={() => {
          setArmed(true);
          timer.current = setTimeout(() => setArmed(false), 3500);
        }}
      >
        {children}
      </button>
    );
  }
  return (
    <button
      type="submit"
      className={className}
      style={{ ...style, background: "var(--red)", color: "#fff", borderColor: "var(--red)" }}
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? "…" : confirmText}
    </button>
  );
}
