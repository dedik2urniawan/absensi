import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });

export const metadata: Metadata = {
  title: "HKN ke-62 — Sehat untuk Semua | Absensi Kegiatan",
  description:
    "Absensi digital Hari Kesehatan Nasional ke-62 Tahun 2026, Dinas Kesehatan Kabupaten Malang.",
  icons: { icon: "/logo-hkn62.png" },
};
export const viewport: Viewport = { themeColor: "#0b6b60" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={jakarta.variable}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
