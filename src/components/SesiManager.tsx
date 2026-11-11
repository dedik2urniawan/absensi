"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { fromLocalInput, sesiStatus, STATUS_LABEL, toLocalInput, type Sesi } from "@/lib/sesi";

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? "Gagal");
}

function SesiCard({ s, onDone }: { s: Sesi; onDone: () => void }) {
  const [nama, setNama] = useState(s.nama);
  const [mulai, setMulai] = useState(toLocalInput(s.mulai));
  const [selesai, setSelesai] = useState(toLocalInput(s.selesai));
  const [err, setErr] = useState("");
  const st = sesiStatus(s);
  const run = async (fn: () => Promise<void>) => {
    setErr("");
    try {
      await fn();
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <div className="card space-y-3 p-5">
      <div className="flex items-center justify-between">
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${st === "buka" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>
          {STATUS_LABEL[st]}{s.override ? ` (manual: ${s.override})` : ""}
        </span>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.aktif} onChange={(e) => run(() => call(`/api/admin/sesi/${s.id}`, "PATCH", { aktif: e.target.checked }))} className="accent-brand-700" />
          Aktif
        </label>
      </div>
      <div>
        <label className="label">Nama sesi</label>
        <input className="input" value={nama} onChange={(e) => setNama(e.target.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Mulai (WIB)</label>
          <input type="datetime-local" className="input" value={mulai} onChange={(e) => setMulai(e.target.value)} />
        </div>
        <div>
          <label className="label">Selesai (WIB)</label>
          <input type="datetime-local" className="input" value={selesai} onChange={(e) => setSelesai(e.target.value)} />
        </div>
      </div>
      {err && <p className="err text-sm">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" onClick={() => run(() => call(`/api/admin/sesi/${s.id}`, "PATCH", { nama, mulai: fromLocalInput(mulai), selesai: fromLocalInput(selesai) }))}>
          Simpan jadwal
        </button>
        <button className="btn btn-outline" onClick={() => run(() => call(`/api/admin/sesi/${s.id}`, "PATCH", { override: "buka" }))}>▶ Buka sekarang</button>
        <button className="btn btn-outline" onClick={() => run(() => call(`/api/admin/sesi/${s.id}`, "PATCH", { override: "tutup" }))}>⏹ Tutup sekarang</button>
        <button className="btn btn-outline" onClick={() => run(() => call(`/api/admin/sesi/${s.id}`, "PATCH", { override: null }))}>↺ Ikuti jadwal</button>
        <button className="btn btn-danger ml-auto" onClick={() => confirm(`Hapus "${s.nama}"?`) && run(() => call(`/api/admin/sesi/${s.id}`, "DELETE"))}>Hapus</button>
      </div>
    </div>
  );
}

export default function SesiManager({ sesi }: { sesi: Sesi[] }) {
  const router = useRouter();
  const [nama, setNama] = useState("");
  const [mulai, setMulai] = useState("");
  const [selesai, setSelesai] = useState("");
  const [err, setErr] = useState("");
  const refresh = () => router.refresh();

  return (
    <div className="space-y-5">
      {sesi.map((s) => (
        <SesiCard key={s.id + s.nama + s.mulai + s.selesai + s.aktif + s.override} s={s} onDone={refresh} />
      ))}
      <div className="card space-y-3 border-dashed p-5">
        <h3 className="font-bold text-brand-900">+ Tambah sesi baru</h3>
        <input className="input" placeholder="Nama sesi" value={nama} onChange={(e) => setNama(e.target.value)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <input type="datetime-local" className="input" value={mulai} onChange={(e) => setMulai(e.target.value)} />
          <input type="datetime-local" className="input" value={selesai} onChange={(e) => setSelesai(e.target.value)} />
        </div>
        {err && <p className="err text-sm">{err}</p>}
        <button
          className="btn btn-primary"
          disabled={!nama || !mulai || !selesai}
          onClick={async () => {
            setErr("");
            try {
              await call("/api/admin/sesi", "POST", { nama, mulai: fromLocalInput(mulai), selesai: fromLocalInput(selesai), aktif: true, override: null });
              setNama(""); setMulai(""); setSelesai("");
              refresh();
            } catch (e) {
              setErr((e as Error).message);
            }
          }}
        >
          Tambah sesi
        </button>
      </div>
    </div>
  );
}
