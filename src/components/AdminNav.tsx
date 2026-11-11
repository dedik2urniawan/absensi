"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

const items = [
  ["/admin", "📊 Statistik"],
  ["/admin/data", "🗂 Data Peserta"],
  ["/admin/daftar-hadir", "🖨 Daftar Hadir"],
  ["/admin/sesi", "⏰ Jadwal Absensi"],
  ["/admin/tautan", "🔗 Link & QR"],
] as const;

export default function AdminNav({ email }: { email: string }) {
  const path = usePathname();
  const router = useRouter();
  return (
    <header className="sticky top-0 z-30 border-b border-brand-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo-hkn62.png" alt="" width={36} height={36} />
          <span className="hidden font-extrabold text-brand-900 sm:block">Admin HKN 62</span>
        </Link>
        <nav className="flex flex-1 gap-1 overflow-x-auto">
          {items.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold ${
                path === href ? "bg-brand-700 text-white" : "text-brand-800 hover:bg-brand-50"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <span className="hidden text-xs text-slate-500 md:block">{email}</span>
        <button
          className="btn btn-outline !py-1.5"
          onClick={async () => {
            await supabaseBrowser().auth.signOut();
            router.replace("/admin/login");
            router.refresh();
          }}
        >
          Keluar
        </button>
      </div>
    </header>
  );
}
