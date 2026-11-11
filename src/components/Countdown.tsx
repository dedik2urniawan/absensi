"use client";
import { useEffect, useState } from "react";

const TARGET = new Date("2026-11-13T06:30:00+07:00").getTime();

export default function Countdown() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const t0 = setTimeout(() => setNow(Date.now()), 0);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, []);
  if (now === null) return <div className="h-[84px]" />;
  const diff = Math.max(0, TARGET - now);
  const parts = [
    ["Hari", Math.floor(diff / 86400000)],
    ["Jam", Math.floor(diff / 3600000) % 24],
    ["Menit", Math.floor(diff / 60000) % 60],
    ["Detik", Math.floor(diff / 1000) % 60],
  ] as const;
  if (diff === 0)
    return <p className="text-lg font-bold text-lime-hkn">Acara telah dimulai — selamat berpartisipasi!</p>;
  return (
    <div className="flex gap-3" aria-label="Hitung mundur menuju HKN">
      {parts.map(([l, v]) => (
        <div key={l} className="w-[70px] rounded-xl bg-white/10 py-3 text-center ring-1 ring-white/20 backdrop-blur">
          <div className="text-2xl font-extrabold tabular-nums text-white">{String(v).padStart(2, "0")}</div>
          <div className="text-[11px] uppercase tracking-wider text-brand-200">{l}</div>
        </div>
      ))}
    </div>
  );
}
