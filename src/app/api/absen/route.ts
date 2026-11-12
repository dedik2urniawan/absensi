import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { absenSchema, MAX_SIGNATURE_BYTES } from "@/lib/schema";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sesiTerbuka, type Sesi } from "@/lib/sesi";
import { clientIp, rateLimitIp, rateLimitPhone } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const err = (message: string, status = 400) => NextResponse.json({ ok: false, message }, { status });

export async function POST(req: Request) {
  // 1. IP rate limit fallback (1200 req / 10 menit untuk shared venue Wi-Fi / CGNAT peserta 500-800)
  if (!rateLimitIp(clientIp(req), 1200, 10 * 60 * 1000)) {
    return err("Terlalu banyak permintaan dari jaringan ini. Coba lagi beberapa menit lagi.", 429);
  }

  // 2. Proteksi ukuran request
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 200_000) return err("Data terlalu besar", 413);

  // 3. Parsing JSON body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err("Permintaan tidak valid");
  }

  // 4. Validasi skema
  const parsed = absenSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Data tidak valid");
  const d = parsed.data;
  if (d.website) return NextResponse.json({ ok: true }); // honeypot bot: pura-pura sukses

  // 5. Rate limit per nomor telepon peserta (max 3 percobaan / 10 menit) sebelum I/O database
  if (!rateLimitPhone(d.nomor_telepon, 3, 10 * 60 * 1000)) {
    return err("Terlalu banyak percobaan untuk nomor telepon ini. Coba lagi beberapa menit lagi.", 429);
  }

  // 6. Validasi integritas buffer tanda tangan di memori sebelum memicu query database
  const bytes = Buffer.from(d.tanda_tangan.split(",")[1] ?? "", "base64");
  if (bytes.length < 100 || bytes.length > MAX_SIGNATURE_BYTES || !bytes.subarray(0, 8).equals(PNG_MAGIC)) {
    return err("Tanda tangan tidak valid");
  }

  // 7. Supabase singleton client (HTTP Keep-Alive connection pooling)
  const sb = supabaseAdmin();

  // 8. Sesi harus sedang dibuka
  const { data: sesiList } = await sb.from("sesi").select("*");
  const sesi = sesiTerbuka((sesiList ?? []) as Sesi[]);
  if (!sesi) return err("Absensi sedang ditutup.", 403);

  // 9. Validasi instansi terhadap master data
  const { data: kat } = await sb.from("instansi_kategori").select("*").eq("kode", d.kategori).maybeSingle();
  if (!kat) return err("Jenis instansi tidak valid");
  let instansiNama = d.instansi_nama;
  if (kat.perlu_teks_lain) {
    // teks bebas
  } else if (kat.punya_sublist) {
    const { data: ok } = await sb
      .from("instansi")
      .select("id")
      .eq("kategori", kat.kode)
      .eq("nama", d.instansi_nama)
      .eq("aktif", true)
      .maybeSingle();
    if (!ok) return err("Asal instansi tidak ada dalam daftar");
  } else {
    instansiNama = kat.label;
  }

  // 10. Cegah duplikat per nomor telepon pada sesi yang sama
  const { data: dup } = await sb
    .from("attendees")
    .select("id")
    .eq("sesi_id", sesi.id)
    .eq("nomor_telepon", d.nomor_telepon)
    .limit(1);
  if (dup && dup.length) return err("Anda sudah tercatat hadir pada sesi ini.", 409);

  // 11. Simpan tanda tangan ke Supabase Storage
  const id = randomUUID();
  const path = `${new Date().toISOString().slice(0, 10)}/${id}.png`;
  const up = await sb.storage.from("signatures").upload(path, bytes, { contentType: "image/png" });
  if (up.error) return err("Gagal menyimpan tanda tangan", 500);

  // 12. Simpan record kehadiran peserta
  const { error } = await sb.from("attendees").insert({
    id,
    nama_lengkap: d.nama_lengkap,
    usia: d.usia,
    kategori: kat.kode,
    instansi_nama: instansiNama,
    jenis_kelamin: d.jenis_kelamin,
    disabilitas: d.disabilitas === "Ya",
    jabatan: d.jabatan || null,
    nomor_telepon: d.nomor_telepon,
    sesi_id: sesi.id,
    tanda_tangan_path: path,
  });
  if (error) {
    await sb.storage.from("signatures").remove([path]);
    if (error.code === "23505") {
      return err("Anda sudah tercatat hadir pada sesi ini.", 409);
    }
    return err("Gagal menyimpan data", 500);
  }
  return NextResponse.json({ ok: true });
}
