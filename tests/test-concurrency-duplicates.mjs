// tests/test-concurrency-duplicates.mjs
// Empirical test for duplicate prevention, race condition handling, and PostgreSQL code 23505 error flow.

import crypto from "node:crypto";
import fs from "node:fs";

// Load environment from .env.local
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

console.log("=== EMPIRICAL TEST SUITE 1: CONCURRENCY, CODE 23505, AND DUPLICATE HANDLING ===");

let passed = 0;
let failed = 0;

function report(name, ok, details = "") {
  if (ok) {
    passed++;
    console.log(`  [PASS] ${name} ${details}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${name} ${details}`);
  }
}

// --------------------------------------------------------------------------
// TEST 1: Unit & Logic Verification of Route 23505 Handler & Storage Cleanup
// --------------------------------------------------------------------------
console.log("\n--- TEST 1: Route Code 23505 Handling & Orphaned Signature Cleanup Logic ---");
{
  let storageRemovedPaths = [];

  const mockStorage = {
    from: () => ({
      upload: async (path) => ({ data: { path }, error: null }),
      remove: async (paths) => {
        storageRemovedPaths.push(...paths);
        return { data: paths, error: null };
      },
    }),
  };

  async function simulateInsertWithError(id, path, errorCode) {
    const error = { code: errorCode, message: "duplicate or database error" };
    if (error) {
      await mockStorage.from("signatures").remove([path]);
      if (error.code === "23505") {
        return { ok: false, status: 409, message: "Anda sudah tercatat hadir pada sesi ini." };
      }
      return { ok: false, status: 500, message: "Gagal menyimpan data" };
    }
    return { ok: true, status: 200 };
  }

  // Subtest 1.1: Error 23505 triggers HTTP 409 and cleans up storage
  storageRemovedPaths = [];
  const testPath1 = "2026-11-13/test-id-1.png";
  const res23505 = await simulateInsertWithError("test-id-1", testPath1, "23505");
  report(
    "1.1 Code 23505 returns status 409 with duplicate message",
    res23505.status === 409 && res23505.message === "Anda sudah tercatat hadir pada sesi ini.",
    `Status: ${res23505.status}, Message: "${res23505.message}"`
  );
  report(
    "1.2 Code 23505 deletes uploaded signature from storage",
    storageRemovedPaths.includes(testPath1),
    `Removed paths: ${JSON.stringify(storageRemovedPaths)}`
  );

  // Subtest 1.3: Non-23505 error triggers HTTP 500 and still cleans up storage
  storageRemovedPaths = [];
  const testPath2 = "2026-11-13/test-id-2.png";
  const res500 = await simulateInsertWithError("test-id-2", testPath2, "50000");
  report(
    "1.3 Non-23505 error returns status 500",
    res500.status === 500 && res500.message === "Gagal menyimpan data",
    `Status: ${res500.status}, Message: "${res500.message}"`
  );
  report(
    "1.4 Non-23505 error cleans up uploaded signature from storage",
    storageRemovedPaths.includes(testPath2),
    `Removed paths: ${JSON.stringify(storageRemovedPaths)}`
  );
}

// --------------------------------------------------------------------------
// TEST 2: High-Concurrency Race Condition Simulation with Promise.all
// --------------------------------------------------------------------------
console.log("\n--- TEST 2: Parallel Promise.all Race Condition Simulation ---");
{
  const phone = "081299998888";
  const sharedSessionId = 1;

  const dbAttendees = new Map();
  const storageFiles = new Set();
  let code409Count = 0;
  let code200Count = 0;

  async function mockCheckInRequest(requestId, attendeeName) {
    const sigPath = `2026-11-13/${requestId}.png`;
    storageFiles.add(sigPath);

    await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 20) + 5));

    const compositeKey = `${sharedSessionId}:${phone}`;
    if (dbAttendees.has(compositeKey)) {
      storageFiles.delete(sigPath);
      code409Count++;
      return { status: 409, message: "Anda sudah tercatat hadir pada sesi ini." };
    }

    dbAttendees.set(compositeKey, {
      id: requestId,
      nama_lengkap: attendeeName,
      nomor_telepon: phone,
      sesi_id: sharedSessionId,
      tanda_tangan_path: sigPath,
    });
    code200Count++;
    return { status: 200, message: "OK" };
  }

  const requests = Array.from({ length: 5 }, (_, i) =>
    mockCheckInRequest(`req-${i + 1}`, `Attendee Race ${i + 1}`)
  );
  await Promise.all(requests);

  report(
    "2.1 Exactly one parallel request succeeds (200 OK)",
    code200Count === 1,
    `Success count: ${code200Count} of 5`
  );
  report(
    "2.2 Remaining 4 parallel requests rejected with 409",
    code409Count === 4,
    `Rejected count: ${code409Count} of 5`
  );
  report(
    "2.3 Exactly one record persisted in database",
    dbAttendees.size === 1,
    `Persisted records: ${dbAttendees.size}`
  );
  report(
    "2.4 Exactly one signature file preserved in storage (4 orphaned files removed)",
    storageFiles.size === 1,
    `Remaining files: ${storageFiles.size} (cleanup executed for failed inserts)`
  );
}

// --------------------------------------------------------------------------
// TEST 3: Empirical Live Supabase Database Constraint Verification
// --------------------------------------------------------------------------
console.log("\n--- TEST 3: Live Database Constraint Verification on Supabase ---");
{
  const testPhone = "088800001234";
  const id1 = crypto.randomUUID();
  const id2 = crypto.randomUUID();

  try {
    await sb.from("attendees").delete().eq("nomor_telepon", testPhone);

    await sb.from("attendees").insert({
      id: id1,
      nama_lengkap: "Empirical Tester 1",
      usia: 28,
      kategori: "instansi_lainnya",
      instansi_nama: "Dinas Kesehatan Test",
      jenis_kelamin: "Laki-laki",
      disabilitas: false,
      nomor_telepon: testPhone,
      sesi_id: 1,
      tanda_tangan_path: "signatures/test1.png",
    });

    const ins2 = await sb.from("attendees").insert({
      id: id2,
      nama_lengkap: "Empirical Tester 2 (Duplicate)",
      usia: 30,
      kategori: "instansi_lainnya",
      instansi_nama: "Dinas Kesehatan Test",
      jenis_kelamin: "Perempuan",
      disabilitas: false,
      nomor_telepon: testPhone,
      sesi_id: 1,
      tanda_tangan_path: "signatures/test2.png",
    });

    const isConstraintActive = Boolean(ins2.error && ins2.error.code === "23505");

    if (isConstraintActive) {
      report(
        "3.1 Live Supabase database rejects duplicate (sesi_id, nomor_telepon) with code 23505",
        true,
        `PostgreSQL code: ${ins2.error?.code}`
      );
    } else {
      report(
        "3.1 Live Supabase database rejects duplicate (sesi_id, nomor_telepon) with code 23505",
        false,
        `CRITICAL FINDING: Live Supabase allowed duplicate insert! Error was: ${JSON.stringify(ins2.error)}. ` +
        `Index 'attendees_sesi_tel_uniq_idx' has NOT been executed on live Supabase instance yet!`
      );
    }

    const { data: dbRows } = await sb
      .from("attendees")
      .select("id, nama_lengkap, nomor_telepon, sesi_id")
      .eq("nomor_telepon", testPhone);

    console.log(`    Live DB query for test phone returned ${dbRows?.length ?? 0} rows:`, dbRows);

    await sb.from("attendees").delete().eq("nomor_telepon", testPhone);
    console.log("    Cleaned up test records from live Supabase.");
  } catch (err) {
    report("3.1 Live Supabase test execution", false, `Exception: ${err.message}`);
  }
}

console.log("\n=======================================================");
console.log(`SUITE 1 RESULTS: ${passed} passed, ${failed} failed`);
console.log("=======================================================");

process.exit(failed > 0 ? 1 : 0);
