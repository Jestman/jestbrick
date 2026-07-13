"use client";

import { useFormStatus } from "react-dom";

/** Form gönderilirken kendini kilitleyip bekleme metni gösteren buton. */
export function PendingButton({
  children,
  pendingText = "…",
  className = "btn btn-y",
  style,
  title,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} style={style} disabled={pending} title={title} aria-busy={pending}>
      {pending ? pendingText : children}
    </button>
  );
}
