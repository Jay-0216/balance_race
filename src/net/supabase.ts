import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The online half is optional. With no keys configured the game still plays
 * single-player end to end - `isOnlineAvailable()` is what the lobby checks
 * before offering a room, rather than letting a click fail with a stack trace.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient | null = null;

export function isOnlineAvailable() {
  return Boolean(url && anonKey && !url.includes("YOUR-PROJECT-REF"));
}

export function supabase(): SupabaseClient {
  if (!isOnlineAvailable()) {
    throw new Error("Supabase is not configured — see .env.example");
  }
  if (!client) {
    client = createClient(url!, anonKey!, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 8 } },
    });
  }
  return client;
}

/** Room codes are typed by hand, so no 0/O or 1/I. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeRoomCode(length = 6) {
  let out = "";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}
