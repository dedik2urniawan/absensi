import QRCode from "qrcode";
import Image from "next/image";
import { headers } from "next/headers";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function TautanPage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const url = `${proto}://${host}/absen`;
  const qr = await QRCode.toDataURL(url, { width: 640, margin: 2, color: { dark: "#063a34", light: "#ffffff" } });

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <h1 className="text-2xl font-extrabold text-brand-900">Link & QR Code Absensi</h1>
        <p className="text-sm text-slate-500">Bagikan tautan atau cetak poster QR untuk meja registrasi.</p>
      </div>
      <div className="card mx-auto max-w-md p-8 text-center print:border-0 print:shadow-none">
        <Image src="/logo-hkn62.png" alt="" width={110} height={110} className="mx-auto" />
        <h2 className="mt-2 text-2xl font-extrabold text-brand-900">Absensi HKN ke-62</h2>
        <p className="text-slate-600">Scan QR untuk mengisi kehadiran</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="QR Code absensi" className="mx-auto my-4 w-64" />
        <p className="break-all rounded-lg bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800">{url}</p>
        <p className="mt-3 text-xs text-slate-500">Dinas Kesehatan Kabupaten Malang · 13 November 2026</p>
      </div>
      <div className="flex justify-center gap-3 print:hidden">
        <PrintButton />
      </div>
    </div>
  );
}
