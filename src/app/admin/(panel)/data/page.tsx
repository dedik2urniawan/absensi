import { supabaseAdmin } from "@/lib/supabase/admin";
import { fetchAllAttendees } from "@/lib/attendees";
import DataTable, { type Row } from "@/components/DataTable";

export const dynamic = "force-dynamic";

export default async function DataPage() {
  const sb = supabaseAdmin();
  const [rows, { data: kat }, { data: sesi }] = await Promise.all([
    fetchAllAttendees(),
    sb.from("instansi_kategori").select("kode,label").order("urut"),
    sb.from("sesi").select("id,nama").order("mulai"),
  ]);
  const view: Row[] = rows
    .map(({ tanda_tangan_path: _t, ...r }) => {
      void _t;
      return r;
    })
    .reverse();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-brand-900">Data Peserta</h1>
      <DataTable rows={view} kategori={kat ?? []} sesi={sesi ?? []} />
    </div>
  );
}
