import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role istemcisi — YALNIZCA sunucu tarafında (Server Action / Route Handler).
 * RLS'i atlar; kullanıcı doğrulaması çağıran kodda yapılmış olmalı.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
