import Image from "next/image";
import Link from "next/link";
import Countdown from "@/components/Countdown";

const acara = [
  ["Senam Sehat Bersama", "06.30 – 08.00 WIB"],
  ["Talkshow Kesehatan", "09.05 – 10.35 WIB"],
  ["Cek Kesehatan Gratis", "Sepanjang acara"],
  ["Pameran Kesehatan", "Sepanjang acara"],
  ["Puskesmas Innovation Award", "Malam, Puncak HKN"],
];

export default function Home() {
  return (
    <main>
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-lime-hkn/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-brand-400/20 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-14 md:grid-cols-2 md:py-20">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/20">
              Dinas Kesehatan Kabupaten Malang
            </p>
            <h1 className="text-4xl font-extrabold leading-tight md:text-5xl">
              Hari Kesehatan Nasional <span className="text-lime-hkn">ke-62</span>
            </h1>
            <p className="mt-2 text-xl font-semibold text-brand-100">Sehat untuk Semua</p>
            <p className="mt-4 max-w-md text-brand-100/90">
              Jum&apos;at, 13 November 2026 · Halaman Stadion Kanjuruhan. Catat kehadiran Anda secara
              digital — cepat, tanpa antre, tanpa kertas.
            </p>
            <div className="mt-6">
              <Countdown />
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/absen" className="btn bg-lime-hkn text-brand-900 hover:brightness-95 px-6 py-3 text-base">
                Isi Absensi Peserta →
              </Link>
              <Link href="/admin/login" className="btn border border-white/30 text-white hover:bg-white/10 px-6 py-3 text-base">
                Dashboard Admin
              </Link>
            </div>
          </div>
          <div className="flex justify-center">
            <div className="rounded-3xl bg-white p-6 shadow-2xl">
              <Image src="/logo-hkn62.png" alt="Logo HKN ke-62 — Sehat untuk Semua" width={360} height={360} priority />
            </div>
          </div>
        </div>
      </section>

      {/* DUA APLIKASI */}
      <section className="mx-auto -mt-8 grid max-w-6xl gap-5 px-5 md:grid-cols-2">
        <Link href="/absen" className="card group p-6 transition hover:-translate-y-1 hover:shadow-lg">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-2xl">📝</div>
          <h2 className="text-xl font-bold text-brand-900">Absensi Peserta</h2>
          <p className="mt-1 text-slate-600">
            Form kehadiran dengan tanda tangan digital. Cukup satu kali isi, langsung tercatat.
          </p>
          <span className="mt-4 inline-block font-semibold text-brand-700 group-hover:underline">Buka form →</span>
        </Link>
        <Link href="/admin/login" className="card group p-6 transition hover:-translate-y-1 hover:shadow-lg">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-2xl">📊</div>
          <h2 className="text-xl font-bold text-brand-900">Dashboard Admin</h2>
          <p className="mt-1 text-slate-600">
            Statistik kehadiran, kelola data, jadwal absensi, dan cetak daftar hadir (PDF/Word).
          </p>
          <span className="mt-4 inline-block font-semibold text-brand-700 group-hover:underline">Masuk admin →</span>
        </Link>
      </section>

      {/* INFO ACARA */}
      <section className="mx-auto grid max-w-6xl gap-8 px-5 py-16 md:grid-cols-2">
        <div>
          <h2 className="text-2xl font-extrabold text-brand-900">Rangkaian Acara</h2>
          <ul className="mt-5 space-y-3">
            {acara.map(([a, b]) => (
              <li key={a} className="card flex items-center justify-between px-4 py-3">
                <span className="font-semibold text-brand-900">{a}</span>
                <span className="text-sm text-slate-500">{b}</span>
              </li>
            ))}
          </ul>
          <div className="card mt-5 p-5">
            <h3 className="font-bold text-brand-900">Waktu & Tempat</h3>
            <ul className="mt-2 space-y-1 text-slate-700">
              <li>🗓 Jum&apos;at, 13 November 2026</li>
              <li>☀️ 06.30 – 11.30 WIB — Senam dan Talkshow</li>
              <li>🌙 18.00 – selesai — Puncak HKN</li>
              <li>📍 Halaman Stadion Kanjuruhan</li>
            </ul>
            <h3 className="mt-4 font-bold text-brand-900">Dress code</h3>
            <p className="text-slate-700">
              Pagi: kaos HKN 62, bawahan cream, jilbab cream · Malam: nuansa tradisional
            </p>
            <a href="/rundown-hkn-2026.pdf" target="_blank" className="btn btn-outline mt-4">
              Unduh Rundown (PDF)
            </a>
          </div>
        </div>
        <div className="space-y-4">
          <Image
            src="/flyer-hkn.jpeg"
            alt="Flyer Hari Kesehatan Nasional ke-62"
            width={1182}
            height={1477}
            className="w-full rounded-2xl shadow-lg"
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16">
        <h2 className="mb-4 text-2xl font-extrabold text-brand-900">Tema Budaya Nusantara</h2>
        <Image
          src="/tema-hkn.jpeg"
          alt="Tema HKN — busana tradisional di Stadion Kanjuruhan"
          width={1600}
          height={900}
          className="w-full rounded-2xl shadow-lg"
        />
      </section>

      <footer className="bg-brand-900 py-8 text-center text-sm text-brand-100">
        <p className="font-semibold">Dinas Kesehatan Kabupaten Malang</p>
        <p className="mt-1 opacity-80">Jl. Panji No. 120 Kepanjen · (0341) 393730 · dinkes.malangkab.go.id</p>
        <p className="mt-1 opacity-60">© 2026 HKN ke-62 · Sehat untuk Semua</p>
      </footer>
    </main>
  );
}
