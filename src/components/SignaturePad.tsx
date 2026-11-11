"use client";
import { useEffect, useRef, useState } from "react";
import SignaturePadLib from "signature_pad";

const MAX_B64 = 100_000;

/** Ekspor tanda tangan ke PNG ringan (putih, lebar 480px; turun ke 320px bila perlu) */
function exportLight(src: HTMLCanvasElement) {
  for (const w of [480, 320, 240]) {
    const h = Math.round((w * src.height) / src.width);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(src, 0, 0, w, h);
    const url = c.toDataURL("image/png");
    if (url.length <= MAX_B64) return url;
  }
  return null;
}

export default function SignaturePad({ onChange }: { onChange: (v: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePadLib | null>(null);
  const [empty, setEmpty] = useState(true);
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  });

  useEffect(() => {
    const canvas = canvasRef.current!;
    const pad = new SignaturePadLib(canvas, { penColor: "#0a3d36", minWidth: 0.8, maxWidth: 2.4 });
    padRef.current = pad;
    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const data = pad.toData();
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext("2d")!.scale(ratio, ratio);
      pad.clear();
      pad.fromData(data);
    };
    resize();
    window.addEventListener("resize", resize);
    pad.addEventListener("endStroke", () => {
      setEmpty(pad.isEmpty());
      cb.current(pad.isEmpty() ? null : exportLight(canvas));
    });
    return () => {
      window.removeEventListener("resize", resize);
      pad.off();
    };
  }, []);

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-brand-200 bg-white">
        <canvas ref={canvasRef} className="h-44 w-full touch-none" aria-label="Area tanda tangan" />
        {empty && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">
            Tanda tangan di sini
          </span>
        )}
      </div>
      <button
        type="button"
        className="mt-2 text-sm font-semibold text-brand-700 hover:underline"
        onClick={() => {
          padRef.current?.clear();
          setEmpty(true);
          onChange(null);
        }}
      >
        Hapus & ulangi
      </button>
    </div>
  );
}
