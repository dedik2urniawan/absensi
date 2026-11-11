// Membuat/memperbarui akun admin di Supabase Auth.
// Pemakaian: node scripts/setup-admin.mjs <email> <password>
// Membaca kredensial dari .env.local (tidak pernah di-commit).
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
);
const [email, password] = process.argv.slice(2);
if (!email || !password) throw new Error("Usage: node scripts/setup-admin.mjs <email> <password>");

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const probe = await sb.from("admins").select("email").limit(1);
if (probe.error) {
  console.error("Tabel belum ada. Jalankan supabase_schema.sql & supabase_seed.sql di SQL Editor dulu:", probe.error.message);
  process.exit(1);
}

const { data: list } = await sb.auth.admin.listUsers({ perPage: 200 });
const existing = list?.users.find((u) => u.email === email);
if (existing) {
  const { error } = await sb.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
  if (error) throw error;
  console.log("Admin diperbarui:", email);
} else {
  const { error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  console.log("Admin dibuat:", email);
}
await sb.from("admins").upsert({ email });
console.log("Selesai.");
