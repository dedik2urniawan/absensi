"use client";
export default function PrintButton() {
  return (
    <button className="btn btn-primary" onClick={() => window.print()}>
      🖨 Cetak poster QR
    </button>
  );
}
