"use client";
import { useMemo, useState } from "react";

export default function Combobox({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState(value);
  const [open, setOpen] = useState(false);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (s ? options.filter((o) => o.toLowerCase().includes(s)) : options).slice(0, 60);
  }, [q, options]);

  return (
    <div className="relative">
      <input
        className="input"
        value={q}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          onChange(options.includes(e.target.value) ? e.target.value : "");
        }}
      />
      {open && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-brand-100 bg-white py-1 shadow-xl">
          {list.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">Tidak ditemukan</li>}
          {list.map((o) => (
            <li key={o}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-brand-50"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setQ(o);
                  onChange(o);
                  setOpen(false);
                }}
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
