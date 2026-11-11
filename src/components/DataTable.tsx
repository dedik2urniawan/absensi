"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatWIB } from "@/lib/sesi";

export type Row = {
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
  created_at: string;
};
type Kat = { kode: string; label: string };
type SesiMini = { id: number; nama: string };

const PER = 25;

export default function DataTable({ rows, kategori, sesi }: { rows: Row[]; kategori: Kat[]; sesi: SesiMini[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [fk, setFk] = useState("");
  const [fs, setFs] = useState("");
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState<Row | null>(null);
  const [sig, setSig] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const katLabel = (k: string) => kategori.find((x) => x.kode === k)?.label ?? k;
  const sesiNama = (id: number | null) => sesi.find((s) => s.id === id)?.nama ?? "-";

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!fk || r.kategori === fk) &&
        (!fs || String(r.sesi_id) === fs) &&
        (!s || `${r.nama_lengkap} ${r.instansi_nama} ${r.nomor_telepon} ${r.jabatan ?? ""}`.toLowerCase().includes(s))
    );
  }, [rows, q, fk, fs]);
  const pages = Math.max(1, Math.ceil(filtered.length / PER));
  const cur = Math.min(page, pages);
  const view = filtered.slice((cur - 1) * PER, cur * PER);

  async function save() {
    if (!edit) return;
    setBusy(true);
    setMsg("");
    const { id, created_at: _c, ...body } = edit;
    void _c;
    const res = await fetch(`/api/admin/attendees/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, usia: Number(body.usia) }),
    });
    setBusy(false);
    if (!res.ok) return setMsg((await res.json()).message ?? "Gagal menyimpan");
    setEdit(null);
    router.refresh();
  }
  async function del(r: Row) {
    if (!confirm(`Hapus data "${r.nama_lengkap}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    const res = await fetch(`/api/admin/attendees/${r.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else alert("Gagal menghapus");
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap gap-3 p-4">
        <input className="input max-w-xs" placeholder="Cari nama / instansi / telepon…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select className="input max-w-xs" value={fk} onChange={(e) => { setFk(e.target.value); setPage(1); }}>
          <option value="">Semua jenis instansi</option>
          {kategori.map((k) => <option key={k.kode} value={k.kode}>{k.label}</option>)}
        </select>
        <select className="input max-w-xs" value={fs} onChange={(e) => { setFs(e.target.value); setPage(1); }}>
          <option value="">Semua sesi</option>
          {sesi.map((s) => <option key={s.id} value={s.id}>{s.nama}</option>)}
        </select>
        <span className="ml-auto self-center text-sm font-semibold text-brand-800">{filtered.length} data</span>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-brand-50 text-xs uppercase text-brand-800">
            <tr>
              {["#", "Nama", "Usia", "L/P", "Instansi", "Jabatan", "Telepon", "Disabilitas", "Waktu", "TTD", ""].map((h) => (
                <th key={h} className="px-3 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {view.map((r, i) => (
              <tr key={r.id} className="hover:bg-brand-50/40">
                <td className="px-3 py-2 text-slate-400">{(cur - 1) * PER + i + 1}</td>
                <td className="px-3 py-2 font-semibold">{r.nama_lengkap}</td>
                <td className="px-3 py-2">{r.usia}</td>
                <td className="px-3 py-2">{r.jenis_kelamin === "Laki-laki" ? "L" : "P"}</td>
                <td className="px-3 py-2">
                  <div>{r.instansi_nama}</div>
                  <div className="text-xs text-slate-400">{katLabel(r.kategori)}</div>
                </td>
                <td className="px-3 py-2">{r.jabatan ?? "-"}</td>
                <td className="px-3 py-2">{r.nomor_telepon}</td>
                <td className="px-3 py-2">{r.disabilitas ? "Ya" : "Tidak"}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{formatWIB(r.created_at)}<br />{sesiNama(r.sesi_id)}</td>
                <td className="px-3 py-2">
                  <button className="text-brand-700 hover:underline" onClick={() => setSig(r.id)}>Lihat</button>
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <button className="mr-2 font-semibold text-brand-700 hover:underline" onClick={() => { setMsg(""); setEdit(r); }}>Edit</button>
                  <button className="font-semibold text-red-600 hover:underline" onClick={() => del(r)}>Hapus</button>
                </td>
              </tr>
            ))}
            {view.length === 0 && (
              <tr><td colSpan={11} className="px-3 py-10 text-center text-slate-500">Tidak ada data.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <button className="btn btn-outline" disabled={cur <= 1} onClick={() => setPage(cur - 1)}>← Sebelumnya</button>
        <span className="text-sm text-slate-600">Halaman {cur} / {pages}</span>
        <button className="btn btn-outline" disabled={cur >= pages} onClick={() => setPage(cur + 1)}>Berikutnya →</button>
      </div>

      {sig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSig(null)}>
          <div className="card p-4" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/admin/signature/${sig}`} alt="Tanda tangan" className="max-h-72 rounded-lg bg-white" />
            <button className="btn btn-outline mt-3 w-full" onClick={() => setSig(null)}>Tutup</button>
          </div>
        </div>
      )}

      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-black/50 p-4">
          <div className="card w-full max-w-lg space-y-3 p-6">
            <h2 className="text-lg font-extrabold text-brand-900">Edit Data Peserta</h2>
            <div>
              <label className="label">Nama Lengkap</label>
              <input className="input" value={edit.nama_lengkap} onChange={(e) => setEdit({ ...edit, nama_lengkap: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Usia</label>
                <input className="input" type="number" value={edit.usia} onChange={(e) => setEdit({ ...edit, usia: Number(e.target.value) })} />
              </div>
              <div>
                <label className="label">Telepon</label>
                <input className="input" value={edit.nomor_telepon} onChange={(e) => setEdit({ ...edit, nomor_telepon: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">Jenis Instansi</label>
              <select className="input" value={edit.kategori} onChange={(e) => setEdit({ ...edit, kategori: e.target.value })}>
                {kategori.map((k) => <option key={k.kode} value={k.kode}>{k.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Asal Instansi</label>
              <input className="input" value={edit.instansi_nama} onChange={(e) => setEdit({ ...edit, instansi_nama: e.target.value })} />
            </div>
            <div>
              <label className="label">Jabatan</label>
              <input className="input" value={edit.jabatan ?? ""} onChange={(e) => setEdit({ ...edit, jabatan: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Jenis Kelamin</label>
                <select className="input" value={edit.jenis_kelamin} onChange={(e) => setEdit({ ...edit, jenis_kelamin: e.target.value as Row["jenis_kelamin"] })}>
                  <option>Laki-laki</option><option>Perempuan</option>
                </select>
              </div>
              <div>
                <label className="label">Disabilitas</label>
                <select className="input" value={edit.disabilitas ? "Ya" : "Tidak"} onChange={(e) => setEdit({ ...edit, disabilitas: e.target.value === "Ya" })}>
                  <option>Tidak</option><option>Ya</option>
                </select>
              </div>
            </div>
            {msg && <p className="err text-sm">{msg}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn btn-outline" onClick={() => setEdit(null)}>Batal</button>
              <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? "Menyimpan…" : "Simpan"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
