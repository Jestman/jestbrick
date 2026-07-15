"use client";

import { useState } from "react";

/** Göster/gizle düğmeli şifre alanı (.field içinde kullanılır). */
export function PasswordInput({
  id,
  name = "password",
  autoComplete = "current-password",
  minLength,
  placeholder,
}: {
  id: string;
  name?: string;
  autoComplete?: string;
  minLength?: number;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        id={id}
        name={name}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        minLength={minLength}
        placeholder={placeholder}
        required
        style={{ paddingRight: 44 }}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Şifreyi gizle" : "Şifreyi göster"}
        title={show ? "Gizle" : "Göster"}
        style={{
          position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
          background: "none", border: "none", fontSize: 17, padding: "4px 7px",
          color: "var(--ink3)", lineHeight: 1,
        }}
      >
        {show ? "🙈" : "👁️"}
      </button>
    </div>
  );
}
