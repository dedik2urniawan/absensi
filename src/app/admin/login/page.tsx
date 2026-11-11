"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setLoading(false);
      return setErr("Username atau password salah.");
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-brand-900 to-brand-700 p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-7">
        <div className="text-center">
          <Image src="/logo-hkn62.png" alt="HKN 62" width={96} height={96} className="mx-auto" priority />
          <h1 className="mt-2 text-xl font-extrabold text-brand-900">Dashboard Admin</h1>
          <p className="text-sm text-slate-500">Absensi HKN ke-62</p>
        </div>
        <div>
          <label className="label">Username</label>
          <input className="input" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {err && <p className="err text-sm">{err}</p>}
        <button className="btn btn-primary w-full" disabled={loading}>
          {loading ? "Masuk…" : "Masuk"}
        </button>
        <Link href="/" className="block text-center text-sm text-brand-700 hover:underline">
          ← Kembali ke beranda
        </Link>
      </form>
    </main>
  );
}
