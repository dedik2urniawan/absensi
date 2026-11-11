import { supabaseAdmin } from "@/lib/supabase/admin";
import DaftarForm from "@/components/DaftarForm";

export const dynamic = "force-dynamic";

export default async function DaftarHadirPage() {
  const sb = supabaseAdmin();
  const [{ data: sesi }, { data: kat }] = await Promise.all([
    sb.from("sesi").select("id,nama").order("mulai"),
    sb.from("instansi_kategori").select("kode,label").order("urut"),
  ]);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-900">Generate Daftar Hadir</h1>
        <p className="text-sm text-slate-500">Cetak daftar hadir resmi lengkap dengan tanda tangan peserta.</p>
      </div>
      <DaftarForm sesi={sesi ?? []} kategori={kat ?? []} />
    </div>
  );
}
