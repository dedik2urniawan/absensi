import { supabaseAdmin } from "@/lib/supabase/admin";
import SesiManager from "@/components/SesiManager";
import type { Sesi } from "@/lib/sesi";

export const dynamic = "force-dynamic";

export default async function SesiPage() {
  const { data } = await supabaseAdmin().from("sesi").select("*").order("mulai");
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-900">Jadwal Buka–Tutup Absensi</h1>
        <p className="text-sm text-slate-500">
          Form peserta otomatis terbuka pada rentang waktu sesi. Gunakan tombol manual untuk membuka/menutup lebih awal.
        </p>
      </div>
      <SesiManager sesi={(data ?? []) as Sesi[]} />
    </div>
  );
}
