"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Tarayıcı tarafı Supabase istemcisi (Realtime abonelikleri vb. için). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
