import "server-only";
import React from "react";
import { Document, Image, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { KOP, type Daftar } from "@/lib/daftar";

const W = [6, 28, 28, 9, 11, 18]; // persen
const H = ["No", "Nama Lengkap", "Asal Instansi", "Jenis Kelamin (L/P)", "Disabilitas (Ya/Tidak)", "Tanda Tangan"];

const s = StyleSheet.create({
  page: { padding: 36, paddingBottom: 48, fontSize: 9, fontFamily: "Helvetica" },
  kop: { flexDirection: "row", alignItems: "center", borderBottomWidth: 2, borderBottomColor: "#000", paddingBottom: 6, marginBottom: 10 },
  logo: { width: 62, height: 62, marginRight: 8 },
  kopText: { flex: 1, textAlign: "center" },
  title: { textAlign: "center", fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 4 },
  sub: { textAlign: "center", fontSize: 9, marginTop: 2 },
  info: { textAlign: "center", fontSize: 8, color: "#444", marginTop: 2, marginBottom: 8 },
  row: { flexDirection: "row", borderLeftWidth: 0.7, borderTopWidth: 0.7, borderColor: "#000" },
  cell: { borderRightWidth: 0.7, borderBottomWidth: 0.7, borderColor: "#000", padding: 3, justifyContent: "center" },
  head: { fontFamily: "Helvetica-Bold", textAlign: "center", backgroundColor: "#e8f5f2" },
  footer: { position: "absolute", bottom: 20, left: 36, right: 36, fontSize: 8, color: "#666", flexDirection: "row", justifyContent: "space-between" },
});

const e = React.createElement;

function Doc({ d }: { d: Daftar }) {
  return e(
    Document,
    { title: "Daftar Hadir HKN 2026" },
    e(
      Page,
      { size: "A4", style: s.page },
      e(
        View,
        { style: s.kop },
        e(Image, { src: { data: d.logo, format: "png" }, style: s.logo }),
        e(
          View,
          { style: s.kopText },
          e(Text, { style: { fontSize: 11, fontFamily: "Helvetica-Bold" } }, KOP[0]),
          e(Text, { style: { fontSize: 15, fontFamily: "Helvetica-Bold" } }, KOP[1]),
          ...KOP.slice(2).map((t) => e(Text, { key: t, style: { fontSize: 8 } }, t))
        )
      ),
      e(Text, { style: s.title }, "DAFTAR HADIR HKN"),
      e(Text, { style: s.sub }, d.subtitle),
      e(Text, { style: s.info }, d.filterInfo || " "),
      e(
        View,
        { style: s.row, fixed: true },
        ...H.map((h, i) => e(Text, { key: h, style: [s.cell, s.head, { width: `${W[i]}%` }] }, h))
      ),
      ...d.rows.map((r, idx) =>
        e(
          View,
          { key: r.id, style: s.row, wrap: false },
          e(Text, { style: [s.cell, { width: `${W[0]}%`, textAlign: "center" }] }, String(idx + 1)),
          e(Text, { style: [s.cell, { width: `${W[1]}%` }] }, r.nama_lengkap),
          e(Text, { style: [s.cell, { width: `${W[2]}%` }] }, r.instansi_nama),
          e(Text, { style: [s.cell, { width: `${W[3]}%`, textAlign: "center" }] }, r.jenis_kelamin === "Laki-laki" ? "L" : "P"),
          e(Text, { style: [s.cell, { width: `${W[4]}%`, textAlign: "center" }] }, r.disabilitas ? "Ya" : "Tidak"),
          e(
            View,
            { style: [s.cell, { width: `${W[5]}%`, height: 36, alignItems: "center" }] },
            r.sig ? e(Image, { src: { data: r.sig, format: "png" }, style: { maxHeight: 30, objectFit: "contain" } }) : null
          )
        )
      ),
      e(
        View,
        { style: s.footer, fixed: true },
        e(Text, null, `Total hadir: ${d.rows.length} orang`),
        e(Text, { render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Halaman ${pageNumber} / ${totalPages}` })
      )
    )
  );
}

export async function buildPdf(d: Daftar) {
  return renderToBuffer(e(Doc, { d }) as React.ReactElement<React.ComponentProps<typeof Document>>);
}
