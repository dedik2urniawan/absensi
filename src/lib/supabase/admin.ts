import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const globalForSupabase = globalThis as unknown as {
  supabaseAdminInstance?: SupabaseClient;
};

/**
 * Client service-role singleton: HANYA dipakai di server (route handler / server component).
 * Dimemoisasi pada globalThis untuk mengaktifkan HTTP Keep-Alive dan menghindari
 * overhead TLS/TCP handshake berulang pada container serverless warm.
 */
export function supabaseAdmin(): SupabaseClient {
  if (globalForSupabase.supabaseAdminInstance) {
    return globalForSupabase.supabaseAdminInstance;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Konfigurasi Supabase belum lengkap: NEXT_PUBLIC_SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum disetel");
  }

  const client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  globalForSupabase.supabaseAdminInstance = client;
  return client;
}
