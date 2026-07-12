"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

/** Aktif konuşmaya yeni mesaj düşünce sayfayı tazeler (Supabase Realtime). */
export function LiveRefresh({ conversationId }: { conversationId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    let channel: RealtimeChannel | null = null;

    (async () => {
      // ÖNCE oturum token'ı: RLS'li postgres_changes anon kimlikle satır göremez,
      // kanal "SUBSCRIBED" görünür ama olay hiç gelmez.
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session) await supabase.realtime.setAuth(data.session.access_token);

      channel = supabase
        .channel(`conv-${conversationId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          () => {
            if (active) router.refresh();
          }
        )
        .subscribe((status, err) => {
          if (status !== "SUBSCRIBED") {
            console.warn("[realtime]", status, err?.message ?? "");
          }
        });
    })();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [conversationId, router]);

  return null;
}
