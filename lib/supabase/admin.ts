import { createClient } from "@supabase/supabase-js";
import { supabaseServiceKey, supabaseUrl } from "./env";

/**
 * Service-role client for the few server-side admin operations: the
 * one-time migration of pre-Supabase accounts and permanent account
 * deletion. Bypasses all access rules, so it must only ever run on the
 * server and only after the caller's identity is established.
 */
export function createSupabaseAdmin() {
  if (typeof window !== "undefined") throw new Error("The Supabase admin client is server-only.");
  const url = supabaseUrl();
  const key = supabaseServiceKey();
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY isn't set on the server.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
