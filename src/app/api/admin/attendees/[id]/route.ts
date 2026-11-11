import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const editSchema = z.object({
  nama_lengkap: z.string().trim().min(2).max(120),
  usia: z.number().int().min(5).max(120),
  kategori: z.string().min(1),
  instansi_nama: z.string().trim().min(2).max(200),
  jenis_kelamin: z.enum(["Laki-laki", "Perempuan"]),
  disabilitas: z.boolean(),
  jabatan: z.string().trim().max(120).nullable().optional(),
  nomor_telepon: z.string().regex(/^[0-9]{9,15}$/, "Nomor telepon harus 9–15 digit angka"),
  sesi_id: z.number().int().nullable().optional(),
});

type Ctx = { params: Promise<{ id: string }> };
const uuid = z.string().uuid();

export async function PATCH(req: Request, { params }: Ctx) {
  if (!(await getAdminUser())) return NextResponse.json({ message: "Tidak diizinkan" }, { status: 401 });
  const { id } = await params;
  if (!uuid.safeParse(id).success) return NextResponse.json({ message: "ID tidak valid" }, { status: 400 });
  const p = editSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ message: p.error.issues[0]?.message ?? "Data tidak valid" }, { status: 400 });
  const { error } = await supabaseAdmin()
    .from("attendees")
    .update({ ...p.data, jabatan: p.data.jabatan || null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ message: "Gagal menyimpan" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  if (!(await getAdminUser())) return NextResponse.json({ message: "Tidak diizinkan" }, { status: 401 });
  const { id } = await params;
  if (!uuid.safeParse(id).success) return NextResponse.json({ message: "ID tidak valid" }, { status: 400 });
  const sb = supabaseAdmin();
  const { data } = await sb.from("attendees").select("tanda_tangan_path").eq("id", id).maybeSingle();
  const { error } = await sb.from("attendees").delete().eq("id", id);
  if (error) return NextResponse.json({ message: "Gagal menghapus" }, { status: 500 });
  if (data?.tanda_tangan_path) await sb.storage.from("signatures").remove([data.tanda_tangan_path]);
  return NextResponse.json({ ok: true });
}
