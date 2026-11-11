"use client";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { absenSchema, type AbsenInput, type Instansi, type Kategori } from "@/lib/schema";
import SignaturePad from "./SignaturePad";
import Combobox from "./Combobox";

export default function AttendeeForm({
  kategori,
  instansi,
}: {
  kategori: Kategori[];
  instansi: Instansi[];
}) {
  const [done, setDone] = useState(false);
  const [serverErr, setServerErr] = useState("");
  const [formKey, setFormKey] = useState(0);

  if (done)
    return (
      <div className="card p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-3xl">✅</div>
        <h2 className="text-xl font-extrabold text-brand-900">Absensi berhasil dicatat</h2>
        <p className="mt-2 text-slate-600">Terima kasih telah hadir di HKN ke-62. Selamat mengikuti acara!</p>
        <button
          className="btn btn-outline mt-6"
          onClick={() => {
            setDone(false);
            setFormKey((k) => k + 1);
          }}
        >
          Isi untuk peserta lain
        </button>
      </div>
    );

  return (
    <Inner
      key={formKey}
      kategori={kategori}
      instansi={instansi}
      serverErr={serverErr}
      setServerErr={setServerErr}
      onDone={() => setDone(true)}
    />
  );
}

function Inner({
  kategori,
  instansi,
  serverErr,
  setServerErr,
  onDone,
}: {
  kategori: Kategori[];
  instansi: Instansi[];
  serverErr: string;
  setServerErr: (s: string) => void;
  onDone: () => void;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AbsenInput>({
    resolver: zodResolver(absenSchema),
    defaultValues: { kategori: "", instansi_nama: "", tanda_tangan: "" },
  });
  const kodeKat = watch("kategori");
  const kat = kategori.find((k) => k.kode === kodeKat);
  const opsi = useMemo(
    () => instansi.filter((i) => i.kategori === kodeKat).map((i) => i.nama),
    [instansi, kodeKat]
  );

  const submit = handleSubmit(async (v) => {
    setServerErr("");
    try {
      const res = await fetch("/api/absen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      const j = await res.json();
      if (!j.ok) return setServerErr(j.message ?? "Gagal mengirim");
      onDone();
    } catch {
      setServerErr("Koneksi bermasalah. Coba lagi.");
    }
  });

  return (
    <form onSubmit={submit} className="card space-y-5 p-5 sm:p-7" noValidate>
      <input type="text" tabIndex={-1} autoComplete="off" className="hidden" {...register("website")} />

      <div>
        <label className="label">Nama Lengkap *</label>
        <input className="input" placeholder="Nama sesuai identitas" {...register("nama_lengkap")} />
        {errors.nama_lengkap && <p className="err">{errors.nama_lengkap.message}</p>}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label">Usia *</label>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            placeholder="Tahun"
            {...register("usia", { valueAsNumber: true })}
          />
          {errors.usia && <p className="err">{errors.usia.message}</p>}
        </div>
        <div>
          <label className="label">Nomor Telepon *</label>
          <input className="input" inputMode="numeric" placeholder="08xxxxxxxxxx" {...register("nomor_telepon")} />
          {errors.nomor_telepon && <p className="err">{errors.nomor_telepon.message}</p>}
        </div>
      </div>

      <div>
        <label className="label">Jenis Instansi *</label>
        <select
          className="input"
          {...register("kategori", {
            onChange: () => setValue("instansi_nama", "", { shouldValidate: false }),
          })}
        >
          <option value="">— Pilih jenis instansi —</option>
          {kategori.map((k) => (
            <option key={k.kode} value={k.kode}>
              {k.label}
            </option>
          ))}
        </select>
        {errors.kategori && <p className="err">{errors.kategori.message}</p>}
      </div>

      {kat && kat.punya_sublist && (
        <div key={kat.kode}>
          <label className="label">Asal Instansi — {kat.label} *</label>
          <Combobox
            options={opsi}
            value=""
            placeholder="Ketik untuk mencari…"
            onChange={(v) => setValue("instansi_nama", v, { shouldValidate: true })}
          />
          {errors.instansi_nama && <p className="err">Pilih asal instansi dari daftar</p>}
        </div>
      )}
      {kat && kat.perlu_teks_lain && (
        <div>
          <label className="label">Sebutkan nama instansi *</label>
          <input className="input" {...register("instansi_nama")} />
          {errors.instansi_nama && <p className="err">{errors.instansi_nama.message}</p>}
        </div>
      )}
      {kat && !kat.punya_sublist && !kat.perlu_teks_lain && (
        <input type="hidden" {...register("instansi_nama", { value: kat.label })} />
      )}

      <div>
        <label className="label">Jabatan</label>
        <input className="input" placeholder="Contoh: Perawat, Staf, Kepala Puskesmas" {...register("jabatan")} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <fieldset>
          <legend className="label">Jenis Kelamin *</legend>
          <div className="flex gap-3">
            {["Laki-laki", "Perempuan"].map((v) => (
              <label key={v} className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                <input type="radio" value={v} {...register("jenis_kelamin")} className="accent-brand-700" />
                <span className="text-sm font-medium">{v}</span>
              </label>
            ))}
          </div>
          {errors.jenis_kelamin && <p className="err">{errors.jenis_kelamin.message}</p>}
        </fieldset>
        <fieldset>
          <legend className="label">Disabilitas *</legend>
          <div className="flex gap-3">
            {["Ya", "Tidak"].map((v) => (
              <label key={v} className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                <input type="radio" value={v} {...register("disabilitas")} className="accent-brand-700" />
                <span className="text-sm font-medium">{v}</span>
              </label>
            ))}
          </div>
          {errors.disabilitas && <p className="err">{errors.disabilitas.message}</p>}
        </fieldset>
      </div>

      <div>
        <label className="label">Tanda Tangan *</label>
        <SignaturePad onChange={(v) => setValue("tanda_tangan", v ?? "", { shouldValidate: true })} />
        {errors.tanda_tangan && <p className="err">Tanda tangan wajib diisi</p>}
      </div>

      {serverErr && (
        <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200">
          {serverErr}
        </div>
      )}

      <button className="btn btn-primary w-full py-3 text-base" disabled={isSubmitting}>
        {isSubmitting ? "Mengirim…" : "Kirim Absensi"}
      </button>
    </form>
  );
}
