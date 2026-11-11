import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Client service-role: HANYA dipakai di server (route handler / server component). */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Konfigurasi Supabase belum lengkap");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
