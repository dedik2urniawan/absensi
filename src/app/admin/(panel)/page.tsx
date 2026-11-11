import { fetchAllAttendees } from "@/lib/attendees";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Charts, { AutoRefresh, type Stats } from "@/components/Charts";
import { sesiStatus, STATUS_LABEL, formatWIB, type Sesi } from "@/lib/sesi";

export const dynamic = "force-dynamic";

const count = (arr: string[]) => {
  const m = new Map<string, number>();
  arr.forEach((a) => m.set(a, (m.get(a) ?? 0) + 1));
  return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
};

export default async function Dashboard() {
  const sb = supabaseAdmin();
  const [rows, { data: kat }, { data: sesi }] = await Promise.all([
    fetchAllAttendees(),
    sb.from("instansi_kategori").select("kode,label"),
    sb.from("sesi").select("*").order("mulai"),
  ]);
  const label = new Map((kat ?? []).map((k) => [k.kode, k.label as string]));
  const total = rows.length;
  const laki = rows.filter((r) => r.jenis_kelamin === "Laki-laki").length;
  const disab = rows.filter((r) => r.disabilitas).length;
  const avg = total ? Math.round(rows.reduce((a, r) => a + r.usia, 0) / total) : 0;

  const groups = [
    ["< 18", 0, 17], ["18–25", 18, 25], ["26–35", 26, 35], ["36–45", 36, 45],
    ["46–55", 46, 55], ["56–65", 56, 65], ["> 65", 66, 200],
  ] as const;
  const jam = new Map<string, number>();
  rows.forEach((r) => {
    const d = new Date(r.created_at);
    const k = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", hour: "2-digit", hour12: false }).format(d) + ":00";
    jam.set(k, (jam.get(k) ?? 0) + 1);
  });

  const stats: Stats = {
    perKategori: count(rows.map((r) => label.get(r.kategori) ?? r.kategori)).slice(0, 12),
    topInstansi: count(rows.map((r) => r.instansi_nama)).slice(0, 10),
    gender: [{ name: "Laki-laki", value: laki }, { name: "Perempuan", value: total - laki }],
    disabilitas: [{ name: "Ya", value: disab }, { name: "Tidak", value: total - disab }],
    usia: groups.map(([name, a, b]) => ({ name, value: rows.filter((r) => r.usia >= a && r.usia <= b).length })),
    perJam: [...jam.entries()].map(([name, value]) => ({ name, value })),
  };

  const cards = [
    ["Total Hadir", total, "bg-brand-700 text-white"],
    ["Laki-laki", laki, "bg-white"],
    ["Perempuan", total - laki, "bg-white"],
    ["Disabilitas", disab, "bg-white"],
    ["Rata-rata Usia", avg, "bg-white"],
  ] as const;

  return (
    <div className="space-y-6">
      <AutoRefresh />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold text-brand-900">Statistik Kehadiran</h1>
          <p className="text-sm text-slate-500">Diperbarui otomatis setiap 20 detik</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {cards.map(([t, v, c]) => (
          <div key={t} className={`card p-4 ${c}`}>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{t}</p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums">{v}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {((sesi ?? []) as Sesi[]).map((s) => {
          const st = sesiStatus(s);
          return (
            <div key={s.id} className="card flex items-center justify-between p-4">
              <div>
                <p className="font-bold text-brand-900">{s.nama}</p>
                <p className="text-xs text-slate-500">
                  {formatWIB(s.mulai)} – {formatWIB(s.selesai)}
                </p>
              </div>
              <div className="text-right">
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${st === "buka" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>
                  {STATUS_LABEL[st]}
                </span>
                <p className="mt-1 text-sm font-semibold">{rows.filter((r) => r.sesi_id === s.id).length} hadir</p>
              </div>
            </div>
          );
        })}
      </div>

      {total === 0 ? (
        <div className="card p-10 text-center text-slate-500">Belum ada data kehadiran.</div>
      ) : (
        <Charts s={stats} />
      )}
    </div>
  );
}
