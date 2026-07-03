import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Tembel başlatma: build sırasında DATABASE_URL yoksa patlamasın,
// sadece gerçekten sorgu atılınca bağlansın.
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function db() {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL tanımlı değil — .env.local dosyanı kontrol et.");
    }
    // Supabase transaction pooler prepared statement desteklemez.
    const client = postgres(url, { prepare: false });
    _db = drizzle(client, { schema });
  }
  return _db;
}

export function envReady() {
  return Boolean(
    process.env.DATABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export * as schema from "./schema";
