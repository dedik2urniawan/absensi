import { z } from "zod";

export const MAX_SIGNATURE_BYTES = 80 * 1024;

export const absenSchema = z.object({
  nama_lengkap: z.string().trim().min(2, "Nama minimal 2 karakter").max(120),
  usia: z
    .number({ error: "Usia wajib diisi" })
    .int("Usia harus bilangan bulat")
    .min(5, "Usia minimal 5")
    .max(120, "Usia maksimal 120"),
  kategori: z.string().min(1, "Pilih jenis instansi"),
  instansi_nama: z.string().trim().min(2, "Asal instansi wajib diisi").max(200),
  jenis_kelamin: z.enum(["Laki-laki", "Perempuan"], { error: "Pilih jenis kelamin" }),
  disabilitas: z.enum(["Ya", "Tidak"], { error: "Pilih salah satu" }),
  jabatan: z.string().trim().max(120).optional(),
  nomor_telepon: z
    .string()
    .regex(/^[0-9]{9,15}$/, "Nomor telepon harus 9–15 digit angka tanpa spasi atau tanda lain."),
  tanda_tangan: z
    .string()
    .startsWith("data:image/png;base64,", "Tanda tangan wajib diisi")
    .max(Math.ceil((MAX_SIGNATURE_BYTES * 4) / 3) + 64, "Tanda tangan terlalu besar"),
  website: z.string().max(0).optional(), // honeypot
});

export type AbsenInput = z.infer<typeof absenSchema>;

export type Kategori = {
  kode: string;
  label: string;
  urut: number | null;
  punya_sublist: boolean;
  perlu_teks_lain: boolean;
};
export type Instansi = { id: number; kategori: string; nama: string };
