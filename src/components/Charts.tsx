"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from "recharts";

export type Stats = {
  perKategori: { name: string; value: number }[];
  topInstansi: { name: string; value: number }[];
  gender: { name: string; value: number }[];
  disabilitas: { name: string; value: number }[];
  usia: { name: string; value: number }[];
  perJam: { name: string; value: number }[];
};

const COLORS = ["#0b6b60", "#c6d423", "#00b3a0", "#f59e0b", "#6366f1", "#ef4444"];

export function AutoRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}

function Box({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`card p-5 ${className}`}>
      <h3 className="mb-3 font-bold text-brand-900">{title}</h3>
      <div className="h-64">{children}</div>
    </div>
  );
}

function Donut({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2} label>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

function HBar({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="value" name="Peserta" fill="#0b6b60" radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function Charts({ s }: { s: Stats }) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Box title="Jenis Kelamin">
        <Donut data={s.gender} />
      </Box>
      <Box title="Disabilitas">
        <Donut data={s.disabilitas} />
      </Box>
      <Box title="Kelompok Usia">
        <ResponsiveContainer>
          <BarChart data={s.usia}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="value" name="Peserta" fill="#00b3a0" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Box>
      <Box title="Peserta per Jenis Instansi" className="lg:col-span-2">
        <HBar data={s.perKategori} />
      </Box>
      <Box title="10 Instansi Terbanyak">
        <HBar data={s.topInstansi} />
      </Box>
      <Box title="Kehadiran per Jam (WIB)" className="lg:col-span-3">
        <ResponsiveContainer>
          <LineChart data={s.perJam}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="value" name="Peserta" stroke="#0b6b60" strokeWidth={3} dot />
          </LineChart>
        </ResponsiveContainer>
      </Box>
    </div>
  );
}
