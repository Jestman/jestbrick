"use client";

import { useState } from "react";

/** Profil linkini panoya kopyalar — sahibin paylaşım kısayolu. */
export function CopyLink({ handle }: { handle: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      className="btn btn-o"
      type="button"
      onClick={async () => {
        const url = `${window.location.origin}/u/${handle}`;
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          // pano API'si engelliyse (izin/eski tarayıcı) seçilebilir alan yedeği
          const ta = document.createElement("textarea");
          ta.value = url;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "✓ Kopyalandı" : "🔗 Linki Kopyala"}
    </button>
  );
}
