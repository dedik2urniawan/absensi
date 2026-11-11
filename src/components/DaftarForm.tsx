"use client";
import { useState } from "react";

export default function DaftarForm({
  sesi,
  kategori,
}: {
  sesi: { id: number; nama: string }[];
  kategori: { kode: string; label: string }[];
}) {
  const [s, setS] = useState("");
  const [k, setK] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [err, setErr] = useState("");

  async function download(format: "pdf" | "docx") {
    setErr("");
    setLoading(format);
    try {
      const qs = new URLSearchParams({ format });
      if (s) qs.set("sesi", s);
      if (k) qs.set("kategori", k);
      const res = await fetch(`/api/admin/daftar-hadir?${qs}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? `daftar-hadir.${format}`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      setErr("Gagal membuat dokumen. Coba persempit filter (mis. per jenis instansi) lalu ulangi.");
    }
    setLoading(null);
  }

  return (
    <div className="card max-w-xl space-y-4 p-6">
      <div>
        <label className="label">Sesi</label>
        <select className="input" value={s} onChange={(e) => setS(e.target.value)}>
          <option value="">Semua sesi</option>
          {sesi.map((x) => <option key={x.id} value={x.id}>{x.nama}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Jenis instansi</label>
        <select className="input" value={k} onChange={(e) => setK(e.target.value)}>
          <option value="">Semua instansi</option>
          {kategori.map((x) => <option key={x.kode} value={x.kode}>{x.label}</option>)}
        </select>
      </div>
      {err && <p className="err text-sm">{err}</p>}
      <div className="flex flex-wrap gap-3">
        <button className="btn btn-primary" disabled={!!loading} onClick={() => download("pdf")}>
          {loading === "pdf" ? "Membuat PDF…" : "⬇ Unduh PDF (siap cetak)"}
        </button>
        <button className="btn btn-outline" disabled={!!loading} onClick={() => download("docx")}>
          {loading === "docx" ? "Membuat Word…" : "⬇ Unduh Word (dapat diedit)"}
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Format mengikuti template “daftar hadir”: kop Dinas Kesehatan, No, Nama Lengkap, Asal Instansi, Jenis Kelamin,
        Disabilitas, dan Tanda Tangan. Urutan berdasarkan waktu mengisi.
      </p>
    </div>
  );
}
