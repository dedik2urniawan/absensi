#!/usr/bin/env node
// tests/load-test-500-800.mjs
// ==============================================================================
// Synthetic Concurrency Load Testing Harness for Absensi HKN ke-62
// Requirement R4: 500–800 participants, burst rates 5–10 req/s, shared venue IP
// ==============================================================================

import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

// ------------------------------------------------------------------------------
// 1. Environment Loading (.env.local)
// ------------------------------------------------------------------------------
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split(/\r?\n/)) {
    if (line && !line.startsWith("#") && line.includes("=")) {
      const idx = line.indexOf("=");
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("FATAL: Missing Supabase credentials in environment (.env.local)");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ------------------------------------------------------------------------------
// 2. Command Line Argument Parsing
// ------------------------------------------------------------------------------
const args = process.argv.slice(2);
function getArg(name, defaultValue) {
  const prefix = `--${name}=`;
  const match = args.find((a) => a.startsWith(prefix));
  if (match) return match.slice(prefix.length);
  const flagIdx = args.indexOf(`--${name}`);
  if (flagIdx !== -1 && args[flagIdx + 1] && !args[flagIdx + 1].startsWith("--")) {
    return args[flagIdx + 1];
  }
  return defaultValue;
}

const hasFlag = (name) => args.includes(`--${name}`);

const TARGET_URL = (getArg("url", process.env.TARGET_URL || "http://localhost:3000")).replace(/\/+$/, "");
const TOTAL_REQUESTS = parseInt(getArg("count", "800"), 10);
const BURST_RATE = parseInt(getArg("rate", "8"), 10); // requests per second (5-10 req/s)
const MAX_CONCURRENCY = parseInt(getArg("concurrency", "10"), 10);
const VENUE_IP = getArg("venue-ip", "103.20.10.1");
const PHONE_PREFIX = "08999999"; // 8 digits prefix + 4 digits -> 12 digits total
const TEST_TAG = `TEST_LOAD_${Date.now().toString(36).toUpperCase()}`;
const CLEAN_ONLY = hasFlag("clean-only");
const SKIP_CLEANUP = hasFlag("skip-cleanup");

let spawnedServerProcess = null;

// ------------------------------------------------------------------------------
// 3. Automated Post-Test / Pre-Test Cleanup Routine
// ------------------------------------------------------------------------------
async function runCleanup(silent = false) {
  if (!silent) console.log("\n=======================================================");
  if (!silent) console.log("🧹 RUNNING AUTOMATED SUPABASE DB & STORAGE CLEANUP");
  if (!silent) console.log("=======================================================");

  try {
    // 1. Fetch synthetic test attendees (tagged by phone or name prefix)
    const { data: testRows, error: fetchErr } = await sb
      .from("attendees")
      .select("id, nomor_telepon, nama_lengkap, tanda_tangan_path")
      .or(`nomor_telepon.like.${PHONE_PREFIX}%,nama_lengkap.like.TEST_LOAD_%`);

    if (fetchErr) {
      console.error("❌ Failed to query synthetic attendees for cleanup:", fetchErr.message);
      return false;
    }

    const countFound = testRows?.length ?? 0;
    if (!silent) console.log(`Found ${countFound} synthetic attendee records to clean up.`);

    if (countFound > 0) {
      // 2. Remove signatures from storage bucket in chunks of 100
      const storagePaths = testRows.map((r) => r.tanda_tangan_path).filter(Boolean);
      if (storagePaths.length > 0) {
        if (!silent) console.log(`Removing ${storagePaths.length} signature files from Supabase Storage...`);
        for (let i = 0; i < storagePaths.length; i += 100) {
          const chunk = storagePaths.slice(i, i + 100);
          const { error: remErr } = await sb.storage.from("signatures").remove(chunk);
          if (remErr && !silent) {
            console.warn(`  ⚠️ Warning: Chunk removal error: ${remErr.message}`);
          }
        }
      }

      // 3. Delete attendee rows from DB
      const { error: delErr } = await sb
        .from("attendees")
        .delete()
        .or(`nomor_telepon.like.${PHONE_PREFIX}%,nama_lengkap.like.TEST_LOAD_%`);

      if (delErr) {
        console.error("❌ Failed to delete synthetic attendees from DB:", delErr.message);
        return false;
      }
    }

    // 4. Verify post-cleanup state
    const { count: remCount } = await sb
      .from("attendees")
      .select("*", { count: "exact", head: true })
      .or(`nomor_telepon.like.${PHONE_PREFIX}%,nama_lengkap.like.TEST_LOAD_%`);

    const { count: totalReal } = await sb
      .from("attendees")
      .select("*", { count: "exact", head: true });

    if (!silent) {
      console.log(`✅ Cleanup verified. Remaining synthetic records: ${remCount ?? 0}`);
      console.log(`📊 Total real attendees remaining in database: ${totalReal ?? 0} (intact and untainted)`);
    }
    return remCount === 0;
  } catch (err) {
    console.error("❌ Cleanup encountered unexpected exception:", err);
    return false;
  }
}

// ------------------------------------------------------------------------------
// 4. Signal Handlers for Safe Cleanup on Interruption
// ------------------------------------------------------------------------------
let isCleaningUp = false;
async function handleExitSignal(signal) {
  if (isCleaningUp) return;
  isCleaningUp = true;
  console.log(`\n\n⚠️ Received ${signal}. Executing emergency post-test cleanup...`);
  await runCleanup();
  if (spawnedServerProcess) {
    try {
      spawnedServerProcess.kill();
    } catch {}
  }
  process.exit(1);
}
process.on("SIGINT", () => handleExitSignal("SIGINT"));
process.on("SIGTERM", () => handleExitSignal("SIGTERM"));

// ------------------------------------------------------------------------------
// 5. Realistic Data & Signature Generator
// ------------------------------------------------------------------------------
const INDONESIAN_NAMES = [
  "Ahmad Fauzi", "Budi Santoso", "Citra Lestari", "Dewi Anggraini", "Eko Prasetyo",
  "Fajar Hidayat", "Gita Permata", "Hendra Wijaya", "Indah Wahyuni", "Joko Susilo",
  "Kartika Sari", "Lukman Hakim", "Maya Safitri", "Nurul Hidayah", "Oki Setiawan",
  "Putri Rahayu", "Rian Pratama", "Siti Nurhaliza", "Teguh Wibowo", "Wahyu Pratama",
  "Agus Supriyanto", "Bayu Wicaksono", "Dian Sastro", "Fitri Handayani", "Hadi Purnomo"
];

const CATEGORY_DISTRIBUTION = [
  { kategori: "puskesmas", instansi_nama: "UPT PUSKESMAS TUMPANG" },
  { kategori: "puskesmas", instansi_nama: "UPT PUSKESMAS LAWANG" },
  { kategori: "puskesmas", instansi_nama: "UPT PUSKESMAS SINGOSARI" },
  { kategori: "opd_badan", instansi_nama: "Badan Kepegawaian Dan Pengembangan Sumber Daya Manusia" },
  { kategori: "opd_badan", instansi_nama: "Dinas Pendidikan" },
  { kategori: "instansi_lainnya", instansi_nama: "Dinas Kesehatan Kabupaten Malang Panitia HKN" },
  { kategori: "bpjs_kesehatan", instansi_nama: "Kantor Cabang BPJS Kesehatan Kab. Malang" },
  { kategori: "dharma_wanita", instansi_nama: "Dharma Wanita Kab. Malang" }
];

async function createSyntheticSignature(seed) {
  const svgCurve = `
    <svg width="220" height="90" xmlns="http://www.w3.org/2000/svg">
      <path d="M 10 ${40 + (seed % 30)} Q ${50 + (seed % 40)} ${10 + (seed % 20)}, ${100 + (seed % 30)} ${45 + (seed % 25)} T ${200} ${50 + (seed % 20)}" 
            stroke="#1e3a8a" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M ${30 + (seed % 20)} ${60} L ${180 - (seed % 20)} ${70}" stroke="#0284c7" stroke-width="2" fill="none"/>
    </svg>
  `;
  const pngBuffer = await sharp(Buffer.from(svgCurve)).png({ compressionLevel: 6 }).toBuffer();
  return "data:image/png;base64," + pngBuffer.toString("base64");
}

let cachedSignatures = [];
async function prepareSignatureCache(count = 20) {
  for (let i = 0; i < count; i++) {
    cachedSignatures.push(await createSyntheticSignature(i * 17));
  }
}

function generatePayload(index) {
  const baseName = INDONESIAN_NAMES[index % INDONESIAN_NAMES.length];
  const cat = CATEGORY_DISTRIBUTION[index % CATEGORY_DISTRIBUTION.length];
  const phone = `${PHONE_PREFIX}${String(index + 1).padStart(4, "0")}`;
  const sig = cachedSignatures[index % cachedSignatures.length];

  return {
    nama_lengkap: `${TEST_TAG}_${baseName}_${index + 1}`,
    usia: 22 + (index % 45),
    kategori: cat.kategori,
    instansi_nama: cat.instansi_nama,
    jenis_kelamin: index % 2 === 0 ? "Laki-laki" : "Perempuan",
    disabilitas: index % 25 === 0 ? "Ya" : "Tidak",
    jabatan: `Staff Fungsional ${1 + (index % 5)}`,
    nomor_telepon: phone,
    tanda_tangan: sig,
  };
}

// ------------------------------------------------------------------------------
// 6. Request Executor
// ------------------------------------------------------------------------------
async function executeCheckInRequest(targetUrl, payload, venueIp, requestIndex) {
  const tStart = performance.now();
  const endpoint = `${targetUrl}/api/absen`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": venueIp,
        "User-Agent": "HKN-LoadTest/1.0",
      },
      body: JSON.stringify(payload),
    });

    const duration = performance.now() - tStart;
    let responseData = null;
    try {
      responseData = await res.json();
    } catch {}

    return {
      index: requestIndex,
      status: res.status,
      ok: res.status === 200,
      durationMs: duration,
      data: responseData,
      phone: payload.nomor_telepon,
    };
  } catch (err) {
    const duration = performance.now() - tStart;
    return {
      index: requestIndex,
      status: 0,
      ok: false,
      durationMs: duration,
      error: err.message,
      phone: payload.nomor_telepon,
    };
  }
}

// ------------------------------------------------------------------------------
// 7. Latency Percentile Helper
// ------------------------------------------------------------------------------
function calculatePercentiles(latencies) {
  if (latencies.length === 0) return { min: 0, max: 0, mean: 0, p50: 0, p90: 0, p95: 0, p99: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const getP = (p) => sorted[Math.min(Math.floor(sorted.length * p), sorted.length - 1)];

  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    min: Math.round(sorted[0]),
    max: Math.round(sorted[sorted.length - 1]),
    mean: Math.round(sum / sorted.length),
    p50: Math.round(getP(0.5)),
    p90: Math.round(getP(0.9)),
    p95: Math.round(getP(0.95)),
    p99: Math.round(getP(0.99)),
  };
}

// ------------------------------------------------------------------------------
// 8. Server Readiness / Lifecycle Helper
// ------------------------------------------------------------------------------
async function ensureServerReady(targetUrl) {
  try {
    const check = await fetch(`${targetUrl}/api/absen`, { method: "GET" });
    if (check.status === 405 || check.status === 200 || check.status === 400 || check.status === 404) {
      console.log(`Target server is already running and accessible at ${targetUrl}`);
      return;
    }
  } catch {
    // Not running yet
  }

  if (targetUrl.includes("localhost") || targetUrl.includes("127.0.0.1")) {
    console.log(`No active server on ${targetUrl}. Automatically booting Next.js production server ('npx next start -p 3000')...`);
    spawnedServerProcess = spawn("npx", ["next", "start", "-p", "3000"], {
      shell: true,
      stdio: "ignore",
    });

    const maxWaitMs = 30000;
    const startPoll = Date.now();
    while (Date.now() - startPoll < maxWaitMs) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const check = await fetch(`${targetUrl}/absen`, { method: "GET" });
        if (check.ok || check.status === 200) {
          console.log(`✅ Next.js production server successfully started and responsive!`);
          return;
        }
      } catch {}
    }
    throw new Error("Timed out waiting for spawned Next.js server to become ready.");
  } else {
    throw new Error(`Target server at ${targetUrl} is unreachable. Please verify URL.`);
  }
}

// ------------------------------------------------------------------------------
// 9. Main Load Testing Engine
// ------------------------------------------------------------------------------
async function main() {
  console.log("================================================================================");
  console.log("🚀 HKN KE-62 SYNTHETIC CONCURRENCY LOAD TEST HARNESS (REQUIREMENT R4)");
  console.log("================================================================================");
  console.log(`Target URL        : ${TARGET_URL}`);
  console.log(`Total Requests    : ${TOTAL_REQUESTS} synthetic participants`);
  console.log(`Burst Rate        : ${BURST_RATE} requests/second`);
  console.log(`Max Concurrency   : ${MAX_CONCURRENCY} concurrent in-flight requests`);
  console.log(`Simulated Venue IP: ${VENUE_IP} (Shared Venue Wi-Fi)`);
  console.log(`Test Run Tag      : ${TEST_TAG}`);
  console.log(`Phone Prefix      : ${PHONE_PREFIX}xxxx`);
  console.log("================================================================================\n");

  if (CLEAN_ONLY) {
    await runCleanup();
    process.exit(0);
  }

  // Step 1: Health check & Server Boot
  console.log(`[1/5] Checking target server health at ${TARGET_URL} ...`);
  await ensureServerReady(TARGET_URL);

  // Step 2: Clean slate pre-test cleanup
  console.log("\n[2/5] Performing pre-test clean-slate check on Supabase...");
  await runCleanup(true);

  // Step 3: Prepare synthetic signatures
  console.log("\n[3/5] Generating synthetic PNG signature buffers with Sharp...");
  await prepareSignatureCache(25);
  console.log("Generated 25 valid PNG signature templates in memory.");

  // Step 4: Execute load test with paced burst dispatch
  console.log(`\n[4/5] Initiating load test: ${TOTAL_REQUESTS} check-ins @ ~${BURST_RATE} req/s ...`);
  const tOverallStart = performance.now();

  const results = [];
  let activeInFlight = 0;
  let nextScheduledIndex = 0;
  let completedCount = 0;

  const dispatchIntervalMs = Math.floor(1000 / BURST_RATE);

  await new Promise((resolve) => {
    const timer = setInterval(() => {
      while (activeInFlight < MAX_CONCURRENCY && nextScheduledIndex < TOTAL_REQUESTS) {
        const idx = nextScheduledIndex++;
        activeInFlight++;
        const payload = generatePayload(idx);

        executeCheckInRequest(TARGET_URL, payload, VENUE_IP, idx).then((res) => {
          activeInFlight--;
          completedCount++;
          results.push(res);

          // Progress indicator every 50 requests
          if (completedCount % 50 === 0 || completedCount === TOTAL_REQUESTS) {
            const pct = ((completedCount / TOTAL_REQUESTS) * 100).toFixed(1);
            const currentSuccess = results.filter((r) => r.ok).length;
            const current429 = results.filter((r) => r.status === 429).length;
            const currentErr = results.filter((r) => r.status >= 500 || r.status === 0).length;
            process.stdout.write(
              `\r  Progress: ${completedCount}/${TOTAL_REQUESTS} (${pct}%) | 200 OK: ${currentSuccess} | 429 RL: ${current429} | Errors: ${currentErr} | In-flight: ${activeInFlight} `
            );
          }

          if (completedCount === TOTAL_REQUESTS) {
            clearInterval(timer);
            resolve();
          }
        });
      }

      if (nextScheduledIndex >= TOTAL_REQUESTS && activeInFlight === 0) {
        clearInterval(timer);
        resolve();
      }
    }, dispatchIntervalMs);
  });

  const tOverallEnd = performance.now();
  const totalDurationSec = (tOverallEnd - tOverallStart) / 1000;
  console.log("\n\nAll synthetic load requests completed.");

  // Step 5: Statistical Analysis & Verification
  console.log("\n[5/5] Analyzing load test results and latency metrics...");
  const status200 = results.filter((r) => r.status === 200).length;
  const status400 = results.filter((r) => r.status === 400).length;
  const status429 = results.filter((r) => r.status === 429).length;
  const status409 = results.filter((r) => r.status === 409).length;
  const status500 = results.filter((r) => r.status >= 500).length;
  const statusNetErr = results.filter((r) => r.status === 0).length;
  const latencies = results.map((r) => r.durationMs);
  const stats = calculatePercentiles(latencies);
  const effectiveThroughput = (results.length / totalDurationSec).toFixed(2);

  console.log("\n================================================================================");
  console.log("📊 LOAD TEST EXECUTION REPORT — 500–800 PARTICIPANTS");
  console.log("================================================================================");
  console.log(`Total Requests Sent : ${results.length}`);
  console.log(`Success (HTTP 200)   : ${status200} (${((status200 / results.length) * 100).toFixed(1)}%)`);
  if (status400 > 0) {
    const sample400 = results.find((r) => r.status === 400);
    console.log(`Bad Request (400)   : ${status400} (Sample: ${JSON.stringify(sample400?.data)})`);
  }
  console.log(`Rate Limited (429)  : ${status429}`);
  console.log(`Duplicates (409)    : ${status409}`);
  console.log(`Server Errors (5xx) : ${status500}`);
  console.log(`Network Failures    : ${statusNetErr}`);
  console.log("--------------------------------------------------------------------------------");
  console.log(`Total Duration      : ${totalDurationSec.toFixed(2)} seconds`);
  console.log(`Throughput          : ${effectiveThroughput} req/s`);
  console.log("--------------------------------------------------------------------------------");
  console.log("Latency Distribution (Round-Trip Server + Supabase DB + Storage):");
  console.log(`  Min   : ${stats.min} ms`);
  console.log(`  Mean  : ${stats.mean} ms`);
  console.log(`  P50   : ${stats.p50} ms`);
  console.log(`  P90   : ${stats.p90} ms`);
  console.log(`  P95   : ${stats.p95} ms`);
  console.log(`  P99   : ${stats.p99} ms`);
  console.log(`  Max   : ${stats.max} ms`);
  console.log("================================================================================");

  // Verification against criteria
  const isZeroErrors = status500 === 0 && statusNetErr === 0;
  const isZeroLockouts = status429 === 0;
  const isAllSuccess = status200 === results.length;

  console.log("\nVERIFICATION CHECKLIST:");
  console.log(`  [${isZeroErrors ? "PASS" : "FAIL"}] Zero Server Errors (5xx / Connection drop)`);
  console.log(`  [${isZeroLockouts ? "PASS" : "FAIL"}] Zero Rate Limit Lockouts (Shared Venue IP 429)`);
  console.log(`  [${isAllSuccess ? "PASS" : "FAIL"}] 100% Successful Check-ins (${status200}/${results.length})`);
  console.log(`  [${stats.p95 < 2000 ? "PASS" : "WARN"}] P95 Latency under 2,000 ms (${stats.p95} ms)`);

  // Subtest: Phone Rate Limit Positive Verification (Confirm rate limiting works per phone)
  console.log("\n--- Positive Verification: Phone Number Rate Limiter Guard ---");
  const phoneTestNum = "089999999999";
  const pPayload = {
    nama_lengkap: "TEST_LOAD_RatelimitProbe",
    usia: 30,
    kategori: "instansi_lainnya",
    instansi_nama: "Probe Instansi",
    jenis_kelamin: "Laki-laki",
    disabilitas: "Tidak",
    nomor_telepon: phoneTestNum,
    tanda_tangan: cachedSignatures[0],
  };

  console.log(`Sending 5 rapid requests with SAME phone ${phoneTestNum}...`);
  const probeStatuses = [];
  for (let i = 1; i <= 5; i++) {
    const probeRes = await executeCheckInRequest(TARGET_URL, pPayload, VENUE_IP, 9000 + i);
    probeStatuses.push(probeRes.status);
  }
  console.log(`Probe responses for repeated phone: [${probeStatuses.join(", ")}]`);
  const phoneRatelimitWorking = probeStatuses.slice(3).includes(429);
  console.log(`  [${phoneRatelimitWorking ? "PASS" : "FAIL"}] Repeated submissions from same phone are throttled (HTTP 429)`);

  // Step 6: Automated Cleanup
  if (SKIP_CLEANUP) {
    console.log("\n⚠️ --skip-cleanup passed. Preserving synthetic records in Supabase for inspection.");
  } else {
    await runCleanup();
  }

  // Shutdown spawned server if we started it
  if (spawnedServerProcess) {
    console.log("\nTerminating spawned Next.js server instance...");
    try {
      spawnedServerProcess.kill();
    } catch {}
  }

  console.log("\nLoad testing procedure finished.");
  if (!isZeroErrors || !isZeroLockouts || !isAllSuccess) {
    console.error("\n❌ LOAD TEST FAILED TO MEET ZERO ERROR / ZERO LOCKOUT CRITERIA.");
    process.exit(1);
  } else {
    console.log("\n🎯 LOAD TEST PASSED ALL CRITERIA WITH FLYING COLORS!");
    process.exit(0);
  }
}

main().catch((err) => {
  if (spawnedServerProcess) {
    try {
      spawnedServerProcess.kill();
    } catch {}
  }
  console.error("Unhandled fatal exception in load test harness:", err);
  process.exit(1);
});
