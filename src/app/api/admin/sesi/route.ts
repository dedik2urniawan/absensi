import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export const sesiSchema = z
  .object({
    nama: z.string().trim().min(2).max(120),
    mulai: z.string().datetime(),
    selesai: z.string().datetime(),
    aktif: z.boolean().default(true),
    override: z.enum(["buka", "tutup"]).nullable().default(null),
  })
  .refine((v) => new Date(v.selesai) > new Date(v.mulai), "Waktu selesai harus setelah waktu mulai");

export async function POST(req: Request) {
  if (!(await getAdminUser())) return NextResponse.json({ message: "Tidak diizinkan" }, { status: 401 });
  const p = sesiSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ message: p.error.issues[0]?.message }, { status: 400 });
  const { error } = await supabaseAdmin().from("sesi").insert(p.data);
  if (error) return NextResponse.json({ message: "Gagal menyimpan" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
