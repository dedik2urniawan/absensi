import Image from "next/image";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import AttendeeForm from "@/components/AttendeeForm";
import { sesiStatus, sesiTerbuka, formatWIB, STATUS_LABEL, type Sesi } from "@/lib/sesi";
import type { Instansi, Kategori } from "@/lib/schema";

export const dynamic = "force-dynamic";
export const metadata = { title: "Absensi Peserta — HKN ke-62" };

let anonClient: ReturnType<typeof createClient> | null = null;
function getAnonClient() {
  if (!anonClient) {
    anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );
  }
  return anonClient;
}

/** Cache static master data (instansi & kategori) selama 300 detik (5 menit) */
const getCachedMasterData = unstable_cache(
  async () => {
    const sb = getAnonClient();
    const [{ data: kategori, error: errKat }, { data: instansi, error: errInst }] = await Promise.all([
      sb.from("instansi_kategori").select("*").order("urut"),
      sb.from("instansi").select("id,kategori,nama").order("nama").limit(2000),
    ]);
    if (errKat || errInst) {
      throw new Error(`Master data fetch failed: ${errKat?.message || errInst?.message}`);
    }
    return {
      kategori: (kategori ?? []) as Kategori[],
      instansi: (instansi ?? []) as Instansi[],
    };
  },
  ["absen-master-data"],
  { revalidate: 300, tags: ["master-data"] }
);

export default async function AbsenPage() {
  const sb = getAnonClient();
  const [masterData, { data: sesi }] = await Promise.all([
    getCachedMasterData().catch((err) => {
      console.error("Gagal membaca cache master data:", err);
      return { kategori: [] as Kategori[], instansi: [] as Instansi[] };
    }),
    sb.from("sesi").select("*").order("mulai"),
  ]);
  const { kategori, instansi } = masterData;
  const list = (sesi ?? []) as Sesi[];
  const buka = sesiTerbuka(list);
  const next = list.find((s) => sesiStatus(s) === "belum");

  return (
    <main className="min-h-dvh bg-gradient-to-b from-brand-800 to-brand-50 to-40% pb-12">
      <div className="mx-auto max-w-xl px-4 pt-6">
        <Link href="/" className="text-sm font-medium text-brand-100 hover:underline">
          ← Beranda
        </Link>
        <div className="mt-3 flex items-center gap-4 text-white">
          <div className="rounded-2xl bg-white p-2">
            <Image src="/logo-hkn62.png" alt="HKN 62" width={72} height={72} priority />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold leading-tight">Absensi Peserta</h1>
            <p className="text-sm text-brand-100">HKN ke-62 · 13 November 2026</p>
          </div>
        </div>

        <div className="mt-6">
          {buka ? (
            <>
              <p className="mb-3 rounded-xl bg-white/90 px-4 py-2 text-sm font-medium text-brand-800">
                🟢 {buka.nama} sedang dibuka
              </p>
              <AttendeeForm kategori={kategori} instansi={instansi} />
            </>
          ) : (
            <div className="card p-8 text-center">
              <div className="text-4xl">🔒</div>
              <h2 className="mt-3 text-xl font-extrabold text-brand-900">Absensi sedang ditutup</h2>
              {next ? (
                <p className="mt-2 text-slate-600">
                  {next.nama} dibuka pada <b>{formatWIB(next.mulai)}</b>.
                </p>
              ) : (
                <p className="mt-2 text-slate-600">
                  {list.length ? STATUS_LABEL[sesiStatus(list[list.length - 1])] : "Belum ada sesi"}. Terima kasih atas
                  partisipasi Anda.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
