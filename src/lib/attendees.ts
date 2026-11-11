import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type AttendeeRow = {
  id: string;
  nama_lengkap: string;
  usia: number;
  kategori: string;
  instansi_nama: string;
  jenis_kelamin: "Laki-laki" | "Perempuan";
  disabilitas: boolean;
  jabatan: string | null;
  nomor_telepon: string;
  sesi_id: number | null;
  tanda_tangan_path: string | null;
  created_at: string;
};

/** Ambil seluruh data (melewati batas 1000 baris) */
export async function fetchAllAttendees(filter?: { sesi?: number; kategori?: string }) {
  const sb = supabaseAdmin();
  const out: AttendeeRow[] = [];
  for (let from = 0; ; from += 1000) {
    let q = sb
      .from("attendees")
      .select("*")
      .order("created_at", { ascending: true })
      .range(from, from + 999);
    if (filter?.sesi) q = q.eq("sesi_id", filter.sesi);
    if (filter?.kategori) q = q.eq("kategori", filter.kategori);
    const { data, error } = await q;
    if (error) throw error;
    out.push(...(data as AttendeeRow[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}
