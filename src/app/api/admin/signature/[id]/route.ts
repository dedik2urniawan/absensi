import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminUser())) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const sb = supabaseAdmin();
  const { data } = await sb.from("attendees").select("tanda_tangan_path").eq("id", id).maybeSingle();
  if (!data?.tanda_tangan_path) return new NextResponse("Not found", { status: 404 });
  const { data: signed } = await sb.storage.from("signatures").createSignedUrl(data.tanda_tangan_path, 60);
  if (!signed) return new NextResponse("Not found", { status: 404 });
  const res = NextResponse.redirect(signed.signedUrl);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
