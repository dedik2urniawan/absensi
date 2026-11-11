import "server-only";
import {
  AlignmentType, BorderStyle, Document, ImageRun, Packer, Paragraph, Table, TableCell, TableRow, TextRun,
  VerticalAlign, WidthType, Footer, PageNumber,
} from "docx";
import { KOP, type Daftar } from "@/lib/daftar";

const W = [6, 28, 28, 9, 11, 18];
const H = ["No", "Nama Lengkap", "Asal Instansi", "Jenis Kelamin (L/P)", "Disabilitas (Ya/Tidak)", "Tanda Tangan"];
const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: none, bottom: none, left: none, right: none };

const p = (text: string, o: { bold?: boolean; size?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) =>
  new Paragraph({
    alignment: o.align ?? AlignmentType.LEFT,
    children: [new TextRun({ text, bold: o.bold, size: o.size ?? 20 })],
  });

const cell = (children: Paragraph[], i: number, shade?: string) =>
  new TableCell({
    width: { size: W[i], type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    shading: shade ? { fill: shade } : undefined,
    margins: { top: 40, bottom: 40, left: 70, right: 70 },
    children,
  });

export async function buildDocx(d: Daftar) {
  const kop = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { ...noBorders, insideHorizontal: none, insideVertical: none },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 14, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [new Paragraph({ children: [new ImageRun({ type: "png", data: d.logo, transformation: { width: 66, height: 66 } })] })],
          }),
          new TableCell({
            width: { size: 86, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              p(KOP[0], { bold: true, size: 24, align: AlignmentType.CENTER }),
              p(KOP[1], { bold: true, size: 32, align: AlignmentType.CENTER }),
              ...KOP.slice(2).map((t) => p(t, { size: 17, align: AlignmentType.CENTER })),
            ],
          }),
        ],
      }),
    ],
  });

  const header = new TableRow({
    tableHeader: true,
    children: H.map((h, i) => cell([p(h, { bold: true, size: 18, align: AlignmentType.CENTER })], i, "E8F5F2")),
  });
  const body = d.rows.map(
    (r, idx) =>
      new TableRow({
        cantSplit: true,
        height: { value: 640, rule: "atLeast" },
        children: [
          cell([p(String(idx + 1), { size: 18, align: AlignmentType.CENTER })], 0),
          cell([p(r.nama_lengkap, { size: 18 })], 1),
          cell([p(r.instansi_nama, { size: 18 })], 2),
          cell([p(r.jenis_kelamin === "Laki-laki" ? "L" : "P", { size: 18, align: AlignmentType.CENTER })], 3),
          cell([p(r.disabilitas ? "Ya" : "Tidak", { size: 18, align: AlignmentType.CENTER })], 4),
          cell(
            [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: r.sig ? [new ImageRun({ type: "png", data: r.sig, transformation: { width: 85, height: 34 } })] : [],
              }),
            ],
            5
          ),
        ],
      })
  );

  const doc = new Document({
    title: "Daftar Hadir HKN 2026",
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: `Total hadir: ${d.rows.length} orang   |   Halaman `, size: 16 }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16 }),
                ],
              }),
            ],
          }),
        },
        children: [
          kop,
          new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 12, color: "000000", space: 1 } }, children: [] }),
          p("DAFTAR HADIR HKN", { bold: true, size: 26, align: AlignmentType.CENTER }),
          p(d.subtitle, { size: 18, align: AlignmentType.CENTER }),
          p(d.filterInfo || " ", { size: 16, align: AlignmentType.CENTER }),
          new Paragraph({ children: [] }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...body] }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}
