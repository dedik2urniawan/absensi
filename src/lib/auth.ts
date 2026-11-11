import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Mengembalikan user admin yang sah, atau null. Selalu diverifikasi ke server Supabase. */
export async function getAdminUser() {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user?.email) return null;
  const { data } = await supabaseAdmin()
    .from("admins")
    .select("email")
    .eq("email", user.email)
    .maybeSingle();
  return data ? user : null;
}
