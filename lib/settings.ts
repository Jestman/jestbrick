import "server-only";
import { inArray } from "drizzle-orm";
import { db, schema } from "@/db";

export type FlagKey = "market_enabled" | "forum_enabled" | "signup_enabled";
const FLAG_KEYS: FlagKey[] = ["market_enabled", "forum_enabled", "signup_enabled"];

/** Site anahtarlarını okur; kayıt yoksa güvenli varsayılan: açık. */
export async function getFlags(): Promise<Record<FlagKey, boolean>> {
  const rows = await db()
    .select({ key: schema.siteSettings.key, value: schema.siteSettings.value })
    .from(schema.siteSettings)
    .where(inArray(schema.siteSettings.key, FLAG_KEYS));
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value === true]));
  return {
    market_enabled: map.market_enabled ?? true,
    forum_enabled: map.forum_enabled ?? true,
    signup_enabled: map.signup_enabled ?? true,
  };
}

export async function flagEnabled(key: FlagKey): Promise<boolean> {
  return (await getFlags())[key];
}
