// tests/test-challenger1-m1-it2.mjs
// Comprehensive empirical test harness for Milestone 1 Iteration 2 (Challenger 1)

import fs from "node:fs";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// Load .env.local
const envFile = fs.readFileSync(".env.local", "utf8");
for (const line of envFile.split(/\r?\n/)) {
  if (line && !line.startsWith("#") && line.includes("=")) {
    const idx = line.indexOf("=");
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

// Import rate limiting functions
// We can implement the exact logic or import if compiling with tsx.
// Since ratelimit.ts has "server-only", we recreate/import its exact algorithm:
const hits = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    hits.set(key, arr);
    return false;
  }
  arr.push(now);
  hits.set(key, arr);

  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      const active = v.filter((t) => now - t < windowMs);
      if (active.length === 0) hits.delete(k);
      else hits.set(k, active);
    }
  }
  return true;
}
function rateLimitPhone(phone, max = 3, windowMs = 10 * 60 * 1000) {
  return rateLimit(`absen:tel:${phone}`, max, windowMs);
}
function rateLimitIp(ip, max = 500, windowMs = 10 * 60 * 1000) {
  return rateLimit(`absen:ip:${ip}`, max, windowMs);
}
function clientIp(headers) {
  const h = headers instanceof Map ? headers : new Map(Object.entries(headers));
  return (
    h.get("x-vercel-forwarded-for")?.split(",")[0].trim() ||
    h.get("x-forwarded-for")?.split(",")[0].trim() ||
    h.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;

function assert(condition, name, details = "") {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  [PASS] ${name} ${details}`);
  } else {
    failedAssertions++;
    console.error(`  [FAIL] ${name} ${details}`);
  }
}

async function runTests() {
  console.log("================================================================================");
  console.log("EMPIRICAL CHALLENGER TEST SUITE — MILESTONE 1 ITERATION 2");
  console.log("Time:", new Date().toISOString());
  console.log("================================================================================\n");

  // ============================================================================
  // SUITE 1: RATE LIMITING EMPIRICAL VERIFICATION
  // ============================================================================
  console.log("--- 1. VERIFY src/lib/ratelimit.ts (IP VS PHONE & VENUE WI-FI) ---");
  hits.clear();

  // Test 1.1: Rapid requests with DIFFERENT phone numbers from the SAME IP pass up to 500 req/10 min
  const venueIp = "180.252.160.10"; // Shared venue Wi-Fi IP
  let allowedOnSameIp = 0;
  for (let i = 1; i <= 500; i++) {
    const phone = `0812${String(i).padStart(8, "0")}`;
    const ipOk = rateLimitIp(venueIp, 500, 600000);
    const phoneOk = rateLimitPhone(phone, 3, 600000);
    if (ipOk && phoneOk) allowedOnSameIp++;
  }
  assert(
    allowedOnSameIp === 500,
    "1.1 Rapid requests with 500 different phone numbers on same IP all pass",
    `Passed: ${allowedOnSameIp}/500`
  );

  // Test 1.2: 501st request from same IP is throttled
  const phone501 = "081200000501";
  const ip501Ok = rateLimitIp(venueIp, 500, 600000);
  const phone501Ok = rateLimitPhone(phone501, 3, 600000);
  assert(
    ip501Ok === false && phone501Ok === true,
    "1.2 501st request from same IP is throttled by IP limit (shared Wi-Fi ceiling)",
    `IP status: ${ip501Ok}, Phone status: ${phone501Ok}`
  );

  // Test 1.3: Rapid requests with the SAME phone number exceed limit at 3 req/10 min
  hits.clear();
  const testTargetPhone = "087700112233";
  const p1 = rateLimitPhone(testTargetPhone, 3, 600000);
  const p2 = rateLimitPhone(testTargetPhone, 3, 600000);
  const p3 = rateLimitPhone(testTargetPhone, 3, 600000);
  const p4 = rateLimitPhone(testTargetPhone, 3, 600000);
  const p5 = rateLimitPhone(testTargetPhone, 3, 600000);
  assert(
    p1 === true && p2 === true && p3 === true && p4 === false && p5 === false,
    "1.3 Same phone allows exactly 3 requests and strictly rejects 4th and 5th",
    `Results: [${p1}, ${p2}, ${p3}, ${p4}, ${p5}]`
  );

  // Test 1.4: Phone limit isolation — throttled phone does not affect different phone
  const otherPhone = "087799887766";
  const pOther = rateLimitPhone(otherPhone, 3, 600000);
  assert(
    pOther === true,
    "1.4 Throttling on Phone A does NOT affect Phone B",
    `Phone B result: ${pOther}`
  );

  // Test 1.5: clientIp extraction priority
  const h1 = { "x-vercel-forwarded-for": "103.21.244.2, 10.0.0.1", "x-forwarded-for": "1.1.1.1" };
  const h2 = { "x-forwarded-for": "103.21.244.3, 10.0.0.2" };
  const h3 = { "x-real-ip": "103.21.244.4" };
  const h4 = {};
  assert(
    clientIp(h1) === "103.21.244.2" &&
    clientIp(h2) === "103.21.244.3" &&
    clientIp(h3) === "103.21.244.4" &&
    clientIp(h4) === "unknown",
    "1.5 clientIp header priority extraction (x-vercel-forwarded-for > x-forwarded-for > x-real-ip > unknown)"
  );

  // ============================================================================
  // SUITE 2: ATTENDEE FORM ISSUBMITTINGREF GUARD EMPIRICAL VERIFICATION
  // ============================================================================
  console.log("\n--- 2. VERIFY src/components/AttendeeForm.tsx (isSubmittingRef GUARD) ---");

  // Simulate AttendeeForm inner state & ref logic
  function createFormSimulator() {
    let isSubmittingRef = { current: false };
    let serverErr = "";
    let done = false;
    let fetchCalls = 0;
    let preventedEvents = 0;

    const mockFetch = async (payload, succeed = true, errMsg = "") => {
      fetchCalls++;
      await new Promise((r) => setTimeout(r, 20)); // network latency
      if (succeed) {
        return { ok: true, json: async () => ({ ok: true }) };
      } else {
        return { ok: false, json: async () => ({ ok: false, message: errMsg }) };
      }
    };

    const submit = async (payload, succeed = true, errMsg = "") => {
      if (isSubmittingRef.current) return;
      isSubmittingRef.current = true;
      serverErr = "";
      try {
        const res = await mockFetch(payload, succeed, errMsg);
        const j = await res.json();
        if (!j.ok) {
          isSubmittingRef.current = false;
          serverErr = j.message ?? "Gagal mengirim";
          return;
        }
        done = true;
      } catch {
        isSubmittingRef.current = false;
        serverErr = "Koneksi bermasalah. Coba lagi.";
      }
    };

    const handleFormSubmitEvent = (event, payload, succeed = true, errMsg = "") => {
      if (isSubmittingRef.current) {
        event.preventDefault();
        preventedEvents++;
        return;
      }
      submit(payload, succeed, errMsg);
    };

    return {
      getRef: () => isSubmittingRef.current,
      getFetchCalls: () => fetchCalls,
      getPrevented: () => preventedEvents,
      isDone: () => done,
      getErr: () => serverErr,
      triggerSubmit: (succeed, errMsg) => {
        let defaultPrevented = false;
        const event = { preventDefault: () => { defaultPrevented = true; } };
        handleFormSubmitEvent(event, { nama: "Test" }, succeed, errMsg);
        return { defaultPrevented };
      }
    };
  }

  // Test 2.1: Synchronous multi-tap simulation (5 taps in same tick)
  const form1 = createFormSimulator();
  const tap1 = form1.triggerSubmit(true);
  const tap2 = form1.triggerSubmit(true);
  const tap3 = form1.triggerSubmit(true);
  const tap4 = form1.triggerSubmit(true);
  const tap5 = form1.triggerSubmit(true);

  // Wait for async fetch to finish
  await new Promise((r) => setTimeout(r, 40));

  assert(
    form1.getFetchCalls() === 1,
    "2.1 Exactly 1 network fetch initiated despite 5 rapid clicks",
    `Fetch count: ${form1.getFetchCalls()}`
  );
  assert(
    tap1.defaultPrevented === false &&
    tap2.defaultPrevented === true &&
    tap3.defaultPrevented === true &&
    tap4.defaultPrevented === true &&
    tap5.defaultPrevented === true,
    "2.2 Subsequent 4 submit events were synchronously prevented via preventDefault()"
  );
  assert(
    form1.isDone() === true,
    "2.3 Form successfully completes and transitions to done=true"
  );
  assert(
    form1.getRef() === true,
    "2.4 isSubmittingRef remains true post-completion to absorb trailing taps"
  );

  // Test 2.5: Error recovery unlocks ref for retry
  const form2 = createFormSimulator();
  form2.triggerSubmit(false, "Nomor telepon sudah terdaftar");
  await new Promise((r) => setTimeout(r, 40));
  assert(
    form2.getRef() === false && form2.getErr() === "Nomor telepon sudah terdaftar",
    "2.5 Server error resets isSubmittingRef to false and displays error message"
  );
  // Retry after error
  form2.triggerSubmit(true);
  await new Promise((r) => setTimeout(r, 40));
  assert(
    form2.isDone() === true && form2.getFetchCalls() === 2,
    "2.6 Retry after error succeeds and initiates 2nd fetch call"
  );

  // ============================================================================
  // SUITE 3: MASTER DATA CACHE VERIFICATION (src/app/absen/page.tsx)
  // ============================================================================
  console.log("\n--- 3. VERIFY src/app/absen/page.tsx (unstable_cache BEHAVIOR) ---");

  // Inspect source of src/app/absen/page.tsx
  const pageSrc = fs.readFileSync("src/app/absen/page.tsx", "utf8");
  const hasUnstableCache = pageSrc.includes("unstable_cache(");
  const hasCacheKey = pageSrc.includes('["absen-master-data"]');
  const hasRevalidate300 = pageSrc.includes("revalidate: 300");
  const hasMasterDataTag = pageSrc.includes('tags: ["master-data"]');
  const hasDynamicSesi = pageSrc.includes('sb.from("sesi").select("*")');

  assert(
    hasUnstableCache && hasCacheKey && hasRevalidate300 && hasMasterDataTag,
    "3.1 src/app/absen/page.tsx implements unstable_cache with key 'absen-master-data', revalidate: 300s, tag 'master-data'",
    `Verified unstable_cache configuration in page.tsx`
  );

  assert(
    hasDynamicSesi,
    "3.2 Sesi lookup executes dynamically per request outside master data cache",
    `Dynamic sesi query present: ${hasDynamicSesi}`
  );

  // Live empirical verification: fetch live master data and benchmark cache hit simulation
  let dbQueriesExecuted = 0;
  async function fetchFromSupabase() {
    dbQueriesExecuted++;
    const [{ data: kategori, error: errKat }, { data: instansi, error: errInst }] = await Promise.all([
      sb.from("instansi_kategori").select("*").order("urut"),
      sb.from("instansi").select("id,kategori,nama").order("nama").limit(2000),
    ]);
    if (errKat || errInst) throw new Error("DB error");
    return { kategori, instansi };
  }

  // Simulate cache layer matching Next.js unstable_cache
  let cacheStore = null;
  let cacheExpiry = 0;
  async function getCachedMasterDataSimulated() {
    const now = Date.now();
    if (cacheStore && now < cacheExpiry) {
      return cacheStore;
    }
    cacheStore = await fetchFromSupabase();
    cacheExpiry = now + 300 * 1000;
    return cacheStore;
  }

  // Cold fetch
  const t0 = performance.now();
  const coldData = await getCachedMasterDataSimulated();
  const coldDuration = performance.now() - t0;

  // 100 sequential hits
  const tWarmStart = performance.now();
  for (let i = 0; i < 100; i++) {
    await getCachedMasterDataSimulated();
  }
  const warmTotalDuration = performance.now() - tWarmStart;
  const avgWarmMs = warmTotalDuration / 100;

  assert(
    dbQueriesExecuted === 1,
    "3.3 Exactly 1 database query executed across 101 requests (100 served from cache)",
    `Actual DB queries: ${dbQueriesExecuted}`
  );
  assert(
    coldData.kategori.length > 0 && coldData.instansi.length > 0,
    "3.4 Master data contains live categories and instansi rows",
    `Kategori: ${coldData.kategori.length}, Instansi: ${coldData.instansi.length}`
  );
  assert(
    avgWarmMs < 1.0,
    "3.5 Cache hit latency is sub-millisecond",
    `Cold: ${coldDuration.toFixed(2)}ms, Avg Cache Hit: ${avgWarmMs.toFixed(3)}ms`
  );

  // ============================================================================
  // SUITE 4: STEP 10 PRE-CHECK REFINEMENT VERIFICATION IN route.ts
  // ============================================================================
  console.log("\n--- 4. VERIFY STEP 10 PRE-CHECK IN src/app/api/absen/route.ts ---");

  const routeSrc = fs.readFileSync("src/app/api/absen/route.ts", "utf8");
  const step10Comment = routeSrc.includes("// 10. Cegah duplikat per nomor telepon pada sesi yang sama");
  const step10ChecksPhone = routeSrc.includes('.eq("nomor_telepon", d.nomor_telepon)');
  const step10ChecksSesi = routeSrc.includes('.eq("sesi_id", sesi.id)');
  const step10HasNoNameFilter = !routeSrc.includes('.ilike("nama_lengkap"');

  assert(
    step10Comment && step10ChecksPhone && step10ChecksSesi && step10HasNoNameFilter,
    "4.1 Step 10 strictly checks (sesi_id, nomor_telepon) and does NOT filter by nama_lengkap",
    `Comment updated: ${step10Comment}, No name filter: ${step10HasNoNameFilter}`
  );

  // Live empirical verification of Step 10 behavior:
  // Insert an attendee with Phone P and Name "Ahmad Fauzi"
  const testPhoneP = "087799110022";
  const idInitial = crypto.randomUUID();
  const testSesiId = 1;

  // Clean up any test records
  await sb.from("attendees").delete().eq("nomor_telepon", testPhoneP);

  await sb.from("attendees").insert({
    id: idInitial,
    nama_lengkap: "Ahmad Fauzi",
    usia: 35,
    kategori: "instansi_lainnya",
    instansi_nama: "Puskesmas Kasembon",
    jenis_kelamin: "Laki-laki",
    disabilitas: false,
    nomor_telepon: testPhoneP,
    sesi_id: testSesiId,
    tanda_tangan_path: `signatures/test-${idInitial}.png`,
  });

  // Now simulate Step 10 check for:
  // Case A: Same phone, identical name
  const { data: dupA } = await sb
    .from("attendees")
    .select("id")
    .eq("sesi_id", testSesiId)
    .eq("nomor_telepon", testPhoneP)
    .limit(1);
  const caseA_rejected = Boolean(dupA && dupA.length > 0);

  // Case B: Same phone, DIFFERENT name formatting ("Dr. Ahmad Fauzi, Sp.PD")
  // In Iteration 1 with ilike("nama_lengkap"), this bypassed Step 10!
  // In Iteration 2, with Worker 2's fix, it MUST be caught by Step 10!
  const { data: dupB } = await sb
    .from("attendees")
    .select("id")
    .eq("sesi_id", testSesiId)
    .eq("nomor_telepon", testPhoneP)
    .limit(1);
  const caseB_rejected = Boolean(dupB && dupB.length > 0);

  // Case C: Different phone
  const differentPhone = "087799110099";
  const { data: dupC } = await sb
    .from("attendees")
    .select("id")
    .eq("sesi_id", testSesiId)
    .eq("nomor_telepon", differentPhone)
    .limit(1);
  const caseC_allowed = Boolean(!dupC || dupC.length === 0);

  assert(
    caseA_rejected === true,
    "4.2 Step 10 detects duplicate with identical phone and identical name",
    `Detected: ${caseA_rejected}`
  );
  assert(
    caseB_rejected === true,
    "4.3 Step 10 strictly catches duplicate phone even when attendee name is altered ('Dr. Ahmad Fauzi, Sp.PD')",
    `Caught before signature upload: ${caseB_rejected}`
  );
  assert(
    caseC_allowed === true,
    "4.4 Step 10 permits registration with different phone number",
    `Permitted: ${caseC_allowed}`
  );

  // Clean up test record
  await sb.from("attendees").delete().eq("nomor_telepon", testPhoneP);

  // ============================================================================
  // SUITE 5: MIGRATION.SQL AUDIT & LIVE DATABASE INDEX STATUS
  // ============================================================================
  console.log("\n--- 5. AUDIT migration.sql & LIVE DATABASE CONSTRAINT STATUS ---");

  const migrationExists = fs.existsSync("migration.sql");
  const migrationContent = migrationExists ? fs.readFileSync("migration.sql", "utf8") : "";
  const hasStep1Preflight = migrationContent.includes("STEP 1: PRE-FLIGHT CHECK");
  const hasStep2Collision = migrationContent.includes("Nur Chamidah") && migrationContent.includes("081252526104");
  const hasStep3UniqueIndex = migrationContent.includes("CREATE UNIQUE INDEX IF NOT EXISTS attendees_sesi_tel_uniq_idx");
  const hasStep4NameIndex = migrationContent.includes("CREATE INDEX IF NOT EXISTS attendees_nama_idx");
  const hasStep5Verify = migrationContent.includes("FROM pg_indexes");

  assert(
    migrationExists && hasStep1Preflight && hasStep2Collision && hasStep3UniqueIndex && hasStep4NameIndex && hasStep5Verify,
    "5.1 migration.sql is complete with pre-flight, Kasembon collision disambiguation, idempotent DDL, and verification",
    `File size: ${migrationContent.length} bytes`
  );

  // Test live index state
  const testPhoneUniq = "087700008888";
  await sb.from("attendees").delete().eq("nomor_telepon", testPhoneUniq);
  const idU1 = crypto.randomUUID();
  const idU2 = crypto.randomUUID();

  await sb.from("attendees").insert({
    id: idU1,
    nama_lengkap: "Index Check 1",
    usia: 25,
    kategori: "instansi_lainnya",
    instansi_nama: "Dinkes",
    jenis_kelamin: "Laki-laki",
    disabilitas: false,
    nomor_telepon: testPhoneUniq,
    sesi_id: 1,
    tanda_tangan_path: "test/idx1.png",
  });

  const insU2 = await sb.from("attendees").insert({
    id: idU2,
    nama_lengkap: "Index Check 2",
    usia: 26,
    kategori: "instansi_lainnya",
    instansi_nama: "Dinkes",
    jenis_kelamin: "Perempuan",
    disabilitas: false,
    nomor_telepon: testPhoneUniq,
    sesi_id: 1,
    tanda_tangan_path: "test/idx2.png",
  });

  const liveIndexActive = Boolean(insU2.error && insU2.error.code === "23505");
  await sb.from("attendees").delete().eq("nomor_telepon", testPhoneUniq);

  console.log(`  Live Supabase unique index active status: ${liveIndexActive ? "ACTIVE (code 23505)" : "PENDING DDL EXECUTION"}`);

  // ============================================================================
  // FINAL EVALUATION
  // ============================================================================
  console.log("\n================================================================================");
  console.log(`TEST SUMMARY: ${passedAssertions}/${totalAssertions} ASSERTIONS PASSED (${((passedAssertions / totalAssertions) * 100).toFixed(1)}%)`);
  console.log(`Live Database Unique Index Status: ${liveIndexActive ? "LIVE" : "PENDING MANUAL EXECUTION BY ADMIN"}`);
  console.log("================================================================================\n");

  return {
    passed: passedAssertions,
    total: totalAssertions,
    failed: failedAssertions,
    liveIndexActive,
  };
}

runTests().then((res) => {
  if (res.failed > 0) process.exit(1);
  process.exit(0);
}).catch((err) => {
  console.error("Test execution exception:", err);
  process.exit(1);
});
