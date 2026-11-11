import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fetchAllAttendees, type AttendeeRow } from "@/lib/attendees";

export type DaftarRow = AttendeeRow & { sig: Buffer | null };
export type Daftar = {
  rows: DaftarRow[];
  logo: Buffer;
  subtitle: string;
  filterInfo: string;
  filename: string;
};

export const KOP = [
  "PEMERINTAH KABUPATEN MALANG",
  "DINAS KESEHATAN",
  "Jalan Panji Nomor 120 Kepanjen, Kabupaten Malang, Jawa Timur",
  "Telepon (0341) 393730, Faksimile (0341) 393731",
  "Laman: http://dinkes.malangkab.go.id",
  "Pos-el: dinkes@malangkab.go.id, Kode Pos 65163",
];

export async function loadDaftar(sesiId?: number, kategori?: string): Promise<Daftar> {
  const sb = supabaseAdmin();
  const rows = await fetchAllAttendees({ sesi: sesiId, kategori });

  // unduh tanda tangan (konkurensi terbatas)
  const out: DaftarRow[] = rows.map((r) => ({ ...r, sig: null }));
  let i = 0;
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (i < out.length) {
        const row = out[i++];
        if (!row.tanda_tangan_path) continue;
        const { data } = await sb.storage.from("signatures").download(row.tanda_tangan_path);
        if (data) row.sig = Buffer.from(await data.arrayBuffer());
      }
    })
  );

  const [{ data: sesi }, { data: kat }] = await Promise.all([
    sesiId ? sb.from("sesi").select("nama").eq("id", sesiId).maybeSingle() : Promise.resolve({ data: null }),
    kategori ? sb.from("instansi_kategori").select("label").eq("kode", kategori).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const info = [sesi?.nama && `Sesi: ${sesi.nama}`, kat?.label && `Instansi: ${kat.label}`].filter(Boolean).join("  |  ");
  const logo = await readFile(path.join(process.cwd(), "public", "kop-logo.png"));
  return {
    rows: out,
    logo,
    subtitle: "Hari Kesehatan Nasional ke-62 — Jum'at, 13 November 2026",
    filterInfo: info,
    filename: `daftar-hadir-hkn-2026${sesi?.nama ? "-" + sesi.nama.split(" ")[1]?.toLowerCase() : ""}${kategori ? "-" + kategori : ""}`,
  };
}
