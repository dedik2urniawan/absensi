export type Sesi = {
  id: number;
  nama: string;
  mulai: string;
  selesai: string;
  aktif: boolean;
  override: "buka" | "tutup" | null;
};

export type SesiStatus = "buka" | "tutup" | "belum" | "selesai";

export function sesiStatus(s: Sesi, now = new Date()): SesiStatus {
  if (!s.aktif) return "tutup";
  if (s.override === "buka") return "buka";
  if (s.override === "tutup") return "tutup";
  const t = now.getTime();
  if (t < new Date(s.mulai).getTime()) return "belum";
  if (t > new Date(s.selesai).getTime()) return "selesai";
  return "buka";
}

export function sesiTerbuka(list: Sesi[], now = new Date()) {
  return list.find((s) => sesiStatus(s, now) === "buka") ?? null;
}

export const STATUS_LABEL: Record<SesiStatus, string> = {
  buka: "Dibuka",
  tutup: "Ditutup",
  belum: "Belum dimulai",
  selesai: "Selesai",
};

const fmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
export const formatWIB = (iso: string) => fmt.format(new Date(iso)) + " WIB";

/** ISO -> nilai input datetime-local (WIB) */
export function toLocalInput(iso: string) {
  const d = new Date(new Date(iso).getTime() + 7 * 3600 * 1000);
  return d.toISOString().slice(0, 16);
}
/** nilai datetime-local (dianggap WIB) -> ISO */
export function fromLocalInput(v: string) {
  return new Date(v + ":00+07:00").toISOString();
}
