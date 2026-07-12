// 'media' kovasını oluşturur (avatar + paylaşım fotoğrafları). Idempotent.
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const { data: buckets } = await admin.storage.listBuckets();
if (buckets?.some((b) => b.name === "media")) {
  console.log("'media' kovası zaten var.");
} else {
  const { error } = await admin.storage.createBucket("media", {
    public: true,
    fileSizeLimit: "8MB",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  });
  if (error) throw error;
  console.log("'media' kovası oluşturuldu (public, 8MB, yalnızca görsel).");
}
