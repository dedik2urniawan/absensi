import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { loadDaftar } from "@/lib/daftar";
import { buildPdf } from "@/lib/daftar-pdf";
import { buildDocx } from "@/lib/daftar-docx";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!(await getAdminUser())) return new NextResponse("Unauthorized", { status: 401 });
  const u = new URL(req.url).searchParams;
  const format = u.get("format") === "docx" ? "docx" : "pdf";
  const sesi = Number(u.get("sesi")) || undefined;
  const kategori = u.get("kategori")?.match(/^[a-z_]+$/) ? u.get("kategori")! : undefined;

  const d = await loadDaftar(sesi, kategori);
  const body = format === "pdf" ? await buildPdf(d) : await buildDocx(d);
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type":
        format === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${d.filename}.${format}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
