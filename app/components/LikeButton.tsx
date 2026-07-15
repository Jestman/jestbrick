"use client";

import { useState, useTransition } from "react";
import { toggleLikeQuiet } from "@/lib/social/actions";

/** Anlık beğeni: sayfa yenilenmeden kalp + sayaç güncellenir. */
export function LikeButton({
  postId,
  liked,
  count,
}: {
  postId: string;
  liked: boolean;
  count: number;
}) {
  const [state, setState] = useState({ liked, count });
  const [, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-pressed={state.liked}
      aria-label={state.liked ? "Beğeniyi geri al" : "Beğen"}
      onClick={() => {
        // iyimser güncelle; sunucu arka planda işler
        setState((s) => ({ liked: !s.liked, count: s.count + (s.liked ? -1 : 1) }));
        startTransition(() => {
          toggleLikeQuiet(postId).catch(() =>
            setState((s) => ({ liked: !s.liked, count: s.count + (s.liked ? -1 : 1) }))
          );
        });
      }}
      style={{
        display: "flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 9,
        border: "none", background: "none", fontWeight: 600, fontSize: 13.5, cursor: "pointer",
        color: state.liked ? "var(--red)" : "var(--ink2)",
      }}
    >
      {state.liked ? "❤️" : "🤍"} {state.count > 0 ? state.count : ""} Beğen
    </button>
  );
}
