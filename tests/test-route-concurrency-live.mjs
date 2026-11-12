// tests/test-route-concurrency-live.mjs
// Empirical test of concurrent check-in requests against live Supabase backend
// to test TOCTOU race conditions and code 23505 duplicate handling.

import fs from "node:fs";
import crypto from "node:crypto";

const envFile = fs.readFileSync(".env.local", "utf8");
for (const line of envFile.split(/\r?\n/)) {
  if (line && !line.startsWith("#") && line.includes("=")) {
    const idx = line.indexOf("=");
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

console.log("=== EMPIRICAL TEST: LIVE BACKEND CONCURRENT DUPLICATE CHECK-IN ===");

const testPhone = "087711223344";
const testName = "Adversarial Test Concurrency";
const sesiId = 1;

// Clean up any test records beforehand
await sb.from("attendees").delete().eq("nomor_telepon", testPhone);

async function executeCheckInFlow(requestId) {
  const tStart = performance.now();
  const id = crypto.randomUUID();
  const path = `test-concurrency/${id}.png`;

  // Step 10: Pre-check duplicate in DB
  const { data: dup } = await sb
    .from("attendees")
    .select("id")
    .eq("sesi_id", sesiId)
    .eq("nomor_telepon", testPhone)
    .ilike("nama_lengkap", testName)
    .limit(1);

  if (dup && dup.length) {
    return {
      requestId,
      status: 409,
      stage: "step_10_precheck",
      durationMs: performance.now() - tStart,
      message: "Anda sudah tercatat hadir pada sesi ini."
    };
  }

  // Step 11: Upload signature dummy
  const dummyBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(100).fill(0)]);
  const up = await sb.storage.from("signatures").upload(path, dummyBytes, { contentType: "image/png" });
  if (up.error) {
    return { requestId, status: 500, stage: "step_11_storage", error: up.error };
  }

  // Step 12: Insert attendee record
  const { error } = await sb.from("attendees").insert({
    id,
    nama_lengkap: testName,
    usia: 30,
    kategori: "instansi_lainnya",
    instansi_nama: "Dinas Kesehatan Prov",
    jenis_kelamin: "Laki-laki",
    disabilitas: false,
    jabatan: "Staff",
    nomor_telepon: testPhone,
    sesi_id: sesiId,
    tanda_tangan_path: path,
  });

  if (error) {
    await sb.storage.from("signatures").remove([path]);
    if (error.code === "23505") {
      return {
        requestId,
        status: 409,
        stage: "step_12_code_23505",
        durationMs: performance.now() - tStart,
        message: "Anda sudah tercatat hadir pada sesi ini."
      };
    }
    return { requestId, status: 500, stage: "step_12_error", error };
  }

  return {
    requestId,
    status: 200,
    stage: "step_12_success",
    durationMs: performance.now() - tStart,
    path
  };
}

console.log("\nSimulating 2 concurrent requests sent simultaneously via Promise.all()...");
const [resA, resB] = await Promise.all([
  executeCheckInFlow("req-A"),
  executeCheckInFlow("req-B")
]);

console.log("Result A:", resA);
console.log("Result B:", resB);

const { data: attendeesInDb } = await sb
  .from("attendees")
  .select("id, nama_lengkap, nomor_telepon, sesi_id, tanda_tangan_path")
  .eq("nomor_telepon", testPhone);

console.log(`\nAttendees in live DB for phone ${testPhone}:`, attendeesInDb?.length ?? 0);
console.log(JSON.stringify(attendeesInDb, null, 2));

if (attendeesInDb && attendeesInDb.length > 0) {
  const pathsToRemove = attendeesInDb.map((a) => a.tanda_tangan_path).filter(Boolean);
  if (pathsToRemove.length > 0) {
    await sb.storage.from("signatures").remove(pathsToRemove);
  }
  await sb.from("attendees").delete().eq("nomor_telepon", testPhone);
  console.log("Cleaned up test rows and storage files.");
}
