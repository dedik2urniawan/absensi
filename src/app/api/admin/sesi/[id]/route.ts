import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  nama: z.string().trim().min(2).max(120).optional(),
  mulai: z.string().datetime().optional(),
  selesai: z.string().datetime().optional(),
  aktif: z.boolean().optional(),
  override: z.enum(["buka", "tutup"]).nullable().optional(),
});
type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  if (!(await getAdminUser())) return NextResponse.json({ message: "Tidak diizinkan" }, { status: 401 });
  const id = Number((await params).id);
  const p = patchSchema.safeParse(await req.json().catch(() => null));
  if (!Number.isInteger(id) || !p.success) return NextResponse.json({ message: "Data tidak valid" }, { status: 400 });
  if (p.data.mulai && p.data.selesai && new Date(p.data.selesai) <= new Date(p.data.mulai))
    return NextResponse.json({ message: "Waktu selesai harus setelah waktu mulai" }, { status: 400 });
  const { error } = await supabaseAdmin().from("sesi").update(p.data).eq("id", id);
  if (error) return NextResponse.json({ message: "Gagal menyimpan (cek waktu mulai/selesai)" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  if (!(await getAdminUser())) return NextResponse.json({ message: "Tidak diizinkan" }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ message: "ID tidak valid" }, { status: 400 });
  const { error } = await supabaseAdmin().from("sesi").delete().eq("id", id);
  if (error) return NextResponse.json({ message: "Gagal menghapus" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
