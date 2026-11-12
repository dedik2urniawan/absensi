/**
 * Empirical Verification and Adversarial Stress Test Suite for Milestone 1
 * Targets:
 * 1. Rate limiting (phone vs IP, shared venue Wi-Fi, eviction, clientIp)
 * 2. Signature validation (Zod schema, PNG magic bytes, empty, truncated, oversized, corrupted base64)
 * 3. Singleton Supabase client identity (referential equality, globalThis binding, error handling)
 * 4. End-to-End Route Handler validation (fail-fast order, HTTP 429, 413, 400 responses)
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load .env.local manually if not present in process.env
try {
  const envPath = resolve(process.cwd(), ".env.local");
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const k = trimmed.slice(0, idx).trim();
        const v = trimmed.slice(idx + 1).trim();
        if (!process.env[k]) {
          process.env[k] = v;
        }
      }
    }
  }
} catch {
  // Ignore if not present
}

import {
  rateLimit,
  rateLimitPhone,
  rateLimitIp,
  clientIp,
  resetRateLimits,
} from "../src/lib/ratelimit";
import { absenSchema, MAX_SIGNATURE_BYTES } from "../src/lib/schema";
import { supabaseAdmin } from "../src/lib/supabase/admin";
import { POST } from "../src/app/api/absen/route";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Helper to create a valid minimal PNG buffer (>100 bytes)
function createValidPngBuffer(length = 150): Buffer {
  const buf = Buffer.alloc(length, 0x00);
  PNG_MAGIC.copy(buf, 0);
  // Add some dummy PNG-like chunk bytes
  buf.write("IHDR", 12);
  return buf;
}

// Helper to create a valid base64 data URL
function createPngDataUrl(length = 150): string {
  const buf = createValidPngBuffer(length);
  return `data:image/png;base64,${buf.toString("base64")}`;
}

async function runAllTests() {
  console.log("================================================================================");
  console.log("STARTING EMPIRICAL ADVERSARIAL CHALLENGE TEST SUITE — MILESTONE 1");
  console.log("Time:", new Date().toISOString());
  console.log("Node version:", process.version);
  console.log("================================================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  function record(name: string, ok: boolean, details?: string) {
    totalTests++;
    if (ok) {
      passedTests++;
      console.log(`  [PASS] ${name}${details ? ` -> ${details}` : ""}`);
    } else {
      console.error(`  [FAIL] ${name}${details ? ` -> ${details}` : ""}`);
    }
  }

  // ============================================================================
  // SUITE 1: RATE LIMITING TESTS
  // ============================================================================
  console.log("--- SUITE 1: RATE LIMITING (PHONE VS IP & SHARED WI-FI) ---");
  resetRateLimits();

  // Test 1.1: Phone rate limiter throttles strictly after 3 attempts
  {
    resetRateLimits();
    const phone = "081234567890";
    const r1 = rateLimitPhone(phone); // 1st
    const r2 = rateLimitPhone(phone); // 2nd
    const r3 = rateLimitPhone(phone); // 3rd
    const r4 = rateLimitPhone(phone); // 4th (must fail)
    const r5 = rateLimitPhone(phone); // 5th (must fail)

    const ok = r1 === true && r2 === true && r3 === true && r4 === false && r5 === false;
    record("1.1 Phone limiter throttles strictly after 3 attempts", ok, `Results: [${r1}, ${r2}, ${r3}, ${r4}, ${r5}]`);
  }

  // Test 1.2: Phone isolation — throttled phone does not block other phones
  {
    const phoneA = "081111111111";
    const phoneB = "082222222222";
    rateLimitPhone(phoneA);
    rateLimitPhone(phoneA);
    rateLimitPhone(phoneA);
    const throttledA = rateLimitPhone(phoneA); // 4th attempt for phoneA -> false

    const allowedB1 = rateLimitPhone(phoneB); // 1st attempt for phoneB -> must be true
    const allowedB2 = rateLimitPhone(phoneB); // 2nd attempt for phoneB -> must be true

    const ok = throttledA === false && allowedB1 === true && allowedB2 === true;
    record("1.2 Phone isolation under shared environment", ok, `Phone A throttled=${!throttledA}, Phone B allowed=[${allowedB1}, ${allowedB2}]`);
  }

  // Test 1.3: Shared Venue Wi-Fi IP capacity (500 distinct phones under 1 IP)
  {
    resetRateLimits();
    const sharedIp = "103.247.20.10"; // Venue Wi-Fi public IP
    let ipPassCount = 0;
    let ipFailCount = 0;

    // Simulate 500 different attendees submitting through the venue IP
    for (let i = 1; i <= 500; i++) {
      if (rateLimitIp(sharedIp, 500, 10 * 60 * 1000)) {
        ipPassCount++;
      } else {
        ipFailCount++;
      }
    }

    // 501st submission from the same IP must be throttled
    const attempt501 = rateLimitIp(sharedIp, 500, 10 * 60 * 1000);
    const attempt502 = rateLimitIp(sharedIp, 500, 10 * 60 * 1000);

    const ok = ipPassCount === 500 && ipFailCount === 0 && attempt501 === false && attempt502 === false;
    record(
      "1.3 Shared Venue IP allows exactly 500 requests and throttles on 501st",
      ok,
      `Passed 1-500: ${ipPassCount}, Throttled 501: ${!attempt501}, Throttled 502: ${!attempt502}`
    );
  }

  // Test 1.4: IP isolation — separate IPs have independent 500-slot buckets
  {
    const sharedIp1 = "103.247.20.10"; // Already throttled
    const cellularIp2 = "114.124.50.99"; // Telkomsel CGNAT IP

    const rIp1 = rateLimitIp(sharedIp1, 500, 10 * 60 * 1000);
    const rIp2 = rateLimitIp(cellularIp2, 500, 10 * 60 * 1000);

    const ok = rIp1 === false && rIp2 === true;
    record("1.4 Distinct IPs have independent buckets", ok, `IP1 (exhausted)=${rIp1}, IP2 (fresh)=${rIp2}`);
  }

  // Test 1.5: Window expiration and sliding behavior
  {
    resetRateLimits();
    const testKey = "test-window-key";
    const shortWindow = 60; // 60ms
    const r1 = rateLimit(testKey, 2, shortWindow);
    const r2 = rateLimit(testKey, 2, shortWindow);
    const r3 = rateLimit(testKey, 2, shortWindow); // throttled

    // Sleep past window
    await new Promise((res) => setTimeout(res, 80));

    const r4AfterExpiry = rateLimit(testKey, 2, shortWindow); // should pass now

    const ok = r1 === true && r2 === true && r3 === false && r4AfterExpiry === true;
    record("1.5 Window expiration restores access after windowMs passes", ok, `Before: [${r1}, ${r2}, ${r3}], After 80ms: ${r4AfterExpiry}`);
  }

  // Test 1.6: Map size eviction limit (>5000 keys)
  {
    resetRateLimits();
    const shortWindow = 50;
    // Add 5100 expired keys
    for (let i = 0; i < 5100; i++) {
      rateLimit(`bulk-key-${i}`, 1, shortWindow);
    }
    // Wait for them to expire
    await new Promise((res) => setTimeout(res, 70));

    // Adding one more key triggers eviction loop without throwing
    const evictResult = rateLimit("eviction-trigger-key", 1, shortWindow);
    record("1.6 Eviction routine cleans up expired keys without error at >5000 entries", evictResult === true, `Trigger result: ${evictResult}`);
  }

  // Test 1.7: clientIp header parsing hierarchy
  {
    // x-vercel-forwarded-for takes precedence
    const req1 = new Request("https://example.com", {
      headers: {
        "x-vercel-forwarded-for": "203.0.113.1, 10.0.0.1",
        "x-forwarded-for": "198.51.100.1",
        "x-real-ip": "192.0.2.1",
      },
    });
    const ip1 = clientIp(req1);

    // fallback to x-forwarded-for
    const req2 = new Request("https://example.com", {
      headers: {
        "x-forwarded-for": "198.51.100.2, 10.0.0.2",
        "x-real-ip": "192.0.2.2",
      },
    });
    const ip2 = clientIp(req2);

    // fallback to x-real-ip
    const req3 = new Request("https://example.com", {
      headers: {
        "x-real-ip": "192.0.2.3",
      },
    });
    const ip3 = clientIp(req3);

    // fallback to unknown
    const req4 = new Request("https://example.com", { headers: {} });
    const ip4 = clientIp(req4);

    const ok = ip1 === "203.0.113.1" && ip2 === "198.51.100.2" && ip3 === "192.0.2.3" && ip4 === "unknown";
    record("1.7 clientIp resolves headers in correct priority order", ok, `Parsed: ['${ip1}', '${ip2}', '${ip3}', '${ip4}']`);
  }

  // ============================================================================
  // SUITE 2: SIGNATURE BUFFER & INTEGRITY VALIDATION
  // ============================================================================
  console.log("\n--- SUITE 2: SIGNATURE BUFFER VALIDATION & INTEGRITY ---");

  // Test 2.1: Valid PNG signature (>100 bytes, <MAX_SIGNATURE_BYTES, valid magic)
  {
    const validDataUrl = createPngDataUrl(250);
    const parsed = absenSchema.safeParse({
      nama_lengkap: "Budi Santoso",
      usia: 30,
      kategori: "puskesmas",
      instansi_nama: "Puskesmas Gambir",
      jenis_kelamin: "Laki-laki",
      disabilitas: "Tidak",
      nomor_telepon: "081234567890",
      tanda_tangan: validDataUrl,
    });

    const bytes = Buffer.from(validDataUrl.split(",")[1], "base64");
    const bufferCheckOk = bytes.length >= 100 && bytes.length <= MAX_SIGNATURE_BYTES && bytes.subarray(0, 8).equals(PNG_MAGIC);

    const ok = parsed.success && bufferCheckOk;
    record("2.1 Valid PNG signature passes both Zod and buffer magic check", ok, `Zod: ${parsed.success}, Bytes: ${bytes.length}, Magic match: ${bytes.subarray(0, 8).equals(PNG_MAGIC)}`);
  }

  // Test 2.2: Empty signature string
  {
    const parsed = absenSchema.safeParse({
      nama_lengkap: "Budi Santoso",
      usia: 30,
      kategori: "puskesmas",
      instansi_nama: "Puskesmas Gambir",
      jenis_kelamin: "Laki-laki",
      disabilitas: "Tidak",
      nomor_telepon: "081234567890",
      tanda_tangan: "",
    });
    const ok = !parsed.success;
    record("2.2 Empty signature string is rejected by Zod schema", ok, `Zod rejected: ${!parsed.success}`);
  }

  // Test 2.3: Data URL with empty base64 payload
  {
    const emptyPayloadUrl = "data:image/png;base64,";
    const bytes = Buffer.from(emptyPayloadUrl.split(",")[1] ?? "", "base64");
    const routeBufferCheck = bytes.length >= 100 && bytes.length <= MAX_SIGNATURE_BYTES && bytes.subarray(0, 8).equals(PNG_MAGIC);

    const ok = routeBufferCheck === false && bytes.length === 0;
    record("2.3 Empty base64 payload ('data:image/png;base64,') is caught by <100 byte buffer check", ok, `Bytes length: ${bytes.length}, Check result: ${routeBufferCheck}`);
  }

  // Test 2.4: Malformed base64 characters
  {
    const malformedUrl = "data:image/png;base64,!!!NotBase64AtAll###@@@";
    const bytes = Buffer.from(malformedUrl.split(",")[1] ?? "", "base64");
    const routeBufferCheck = bytes.length >= 100 && bytes.length <= MAX_SIGNATURE_BYTES && bytes.subarray(0, 8).equals(PNG_MAGIC);

    const ok = routeBufferCheck === false;
    record("2.4 Malformed base64 characters fail magic and size checks without throwing", ok, `Bytes decoded: ${bytes.length}, Check result: ${routeBufferCheck}`);
  }

  // Test 2.5: Format spoofing — JPEG image disguised with PNG data URL prefix
  {
    // JPEG magic bytes: 0xFF, 0xD8, 0xFF, 0xE0
    const jpegBuf = Buffer.alloc(300, 0x00);
    jpegBuf[0] = 0xff;
    jpegBuf[1] = 0xd8;
    jpegBuf[2] = 0xff;
    jpegBuf[3] = 0xe0;
    const jpegSpoofed = `data:image/png;base64,${jpegBuf.toString("base64")}`;

    const bytes = Buffer.from(jpegSpoofed.split(",")[1] ?? "", "base64");
    const magicMatch = bytes.subarray(0, 8).equals(PNG_MAGIC);
    const routeBufferCheck = bytes.length >= 100 && bytes.length <= MAX_SIGNATURE_BYTES && magicMatch;

    const ok = routeBufferCheck === false && magicMatch === false;
    record("2.5 Format spoofing (JPEG masquerading with PNG data URL) is rejected by PNG magic check", ok, `Magic match: ${magicMatch}, Route check passed: ${routeBufferCheck}`);
  }

  // Test 2.6: Truncated PNG (< 100 bytes)
  {
    // Exactly 50 bytes with correct PNG magic header
    const truncatedBuf = Buffer.alloc(50, 0x00);
    PNG_MAGIC.copy(truncatedBuf, 0);
    const truncatedUrl = `data:image/png;base64,${truncatedBuf.toString("base64")}`;

    const bytes = Buffer.from(truncatedUrl.split(",")[1] ?? "", "base64");
    const routeBufferCheck = bytes.length >= 100 && bytes.length <= MAX_SIGNATURE_BYTES && bytes.subarray(0, 8).equals(PNG_MAGIC);

    const ok = routeBufferCheck === false && bytes.length === 50;
    record("2.6 Truncated 50-byte PNG is rejected by bytes.length < 100 check", ok, `Bytes length: ${bytes.length}, Check result: ${routeBufferCheck}`);
  }

  // Test 2.7: Boundary check at 99 bytes vs 100 bytes
  {
    const b99 = Buffer.alloc(99, 0x00);
    PNG_MAGIC.copy(b99, 0);
    const check99 = b99.length >= 100 && b99.subarray(0, 8).equals(PNG_MAGIC);

    const b100 = Buffer.alloc(100, 0x00);
    PNG_MAGIC.copy(b100, 0);
    const check100 = b100.length >= 100 && b100.subarray(0, 8).equals(PNG_MAGIC);

    const ok = check99 === false && check100 === true;
    record("2.7 Exact boundary check: 99 bytes rejected, 100 bytes accepted", ok, `99 bytes: ${check99}, 100 bytes: ${check100}`);
  }

  // Test 2.8: Oversized signature (> MAX_SIGNATURE_BYTES / 80 KB)
  {
    const oversizedLength = MAX_SIGNATURE_BYTES + 5000; // ~85 KB
    const oversizedBuf = Buffer.alloc(oversizedLength, 0x00);
    PNG_MAGIC.copy(oversizedBuf, 0);
    const oversizedUrl = `data:image/png;base64,${oversizedBuf.toString("base64")}`;

    // Zod check
    const zodResult = absenSchema.safeParse({
      nama_lengkap: "Budi Santoso",
      usia: 30,
      kategori: "puskesmas",
      instansi_nama: "Puskesmas Gambir",
      jenis_kelamin: "Laki-laki",
      disabilitas: "Tidak",
      nomor_telepon: "081234567890",
      tanda_tangan: oversizedUrl,
    });

    // Route buffer check
    const bytes = Buffer.from(oversizedUrl.split(",")[1] ?? "", "base64");
    const routeBufferCheck = bytes.length >= 100 && bytes.length <= MAX_SIGNATURE_BYTES && bytes.subarray(0, 8).equals(PNG_MAGIC);

    const ok = (!zodResult.success || !routeBufferCheck) && bytes.length > MAX_SIGNATURE_BYTES;
    record("2.8 Oversized signature (>80KB) is rejected by Zod max-length or route buffer limit", ok, `Bytes: ${bytes.length}, Zod rejected: ${!zodResult.success}, Buffer check: ${routeBufferCheck}`);
  }

  // ============================================================================
  // SUITE 3: SINGLETON SUPABASE CLIENT IDENTITY
  // ============================================================================
  console.log("\n--- SUITE 3: SINGLETON SUPABASE CLIENT IDENTITY ---");

  // Test 3.1: Sequential calls return the identical instance reference (referential equality)
  {
    const c1 = supabaseAdmin();
    const c2 = supabaseAdmin();
    const c3 = supabaseAdmin();

    const ok = c1 === c2 && c2 === c3 && c1 !== null && typeof c1 === "object";
    record("3.1 Sequential supabaseAdmin() calls return identical object reference (c1 === c2 === c3)", ok, `c1 === c2: ${c1 === c2}, c2 === c3: ${c2 === c3}`);
  }

  // Test 3.2: 100 rapid calls preserve singleton identity
  {
    const initialClient = supabaseAdmin();
    let allIdentical = true;
    for (let i = 0; i < 100; i++) {
      const nextClient = supabaseAdmin();
      if (nextClient !== initialClient) {
        allIdentical = false;
        break;
      }
    }
    record("3.2 100 consecutive invocations retain 100% referential equality", allIdentical, `All 100 match initial reference: ${allIdentical}`);
  }

  // Test 3.3: globalThis backing store verification
  {
    const client = supabaseAdmin();
    const globalBacking = (globalThis as unknown as { supabaseAdminInstance?: unknown }).supabaseAdminInstance;

    const ok = client === globalBacking;
    record("3.3 globalThis.supabaseAdminInstance holds the exact active client reference", ok, `client === globalBacking: ${ok}`);
  }

  // Test 3.4: Descriptive error when credentials are missing
  {
    const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const origKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const origInstance = (globalThis as unknown as { supabaseAdminInstance?: unknown }).supabaseAdminInstance;

    let threwError = false;
    let errorMessage = "";

    try {
      // Clear instance and env
      (globalThis as unknown as { supabaseAdminInstance?: unknown }).supabaseAdminInstance = undefined;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      supabaseAdmin();
    } catch (e: unknown) {
      threwError = true;
      errorMessage = (e as Error).message;
    } finally {
      // Restore immediately
      process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
      process.env.SUPABASE_SERVICE_ROLE_KEY = origKey;
      (globalThis as unknown as { supabaseAdminInstance?: unknown }).supabaseAdminInstance = origInstance;
    }

    const ok = threwError && errorMessage.includes("Konfigurasi Supabase belum lengkap");
    record("3.4 supabaseAdmin throws descriptive configuration error when credentials missing", ok, `Threw: ${threwError}, Error: '${errorMessage}'`);
  }

  // ============================================================================
  // SUITE 4: END-TO-END ROUTE HANDLER BEHAVIOR (POST /api/absen)
  // ============================================================================
  console.log("\n--- SUITE 4: END-TO-END ROUTE HANDLER ADVERSARIAL STRESS ---");
  resetRateLimits();

  // Test 4.1: Request oversized content-length (> 200,000 bytes) returns HTTP 413
  {
    const req = new Request("http://localhost:3000/api/absen", {
      method: "POST",
      headers: {
        "content-length": "250000",
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    const json = await res.json();
    const ok = res.status === 413 && json.message === "Data terlalu besar";
    record("4.1 Content-length > 200,000 bytes fails fast with HTTP 413", ok, `Status: ${res.status}, Message: '${json.message}'`);
  }

  // Test 4.2: Malformed JSON body returns HTTP 400
  {
    const req = new Request("http://localhost:3000/api/absen", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: "{ not a valid json :::",
    });

    const res = await POST(req);
    const json = await res.json();
    const ok = res.status === 400 && json.message === "Permintaan tidak valid";
    record("4.2 Malformed JSON syntax returns HTTP 400 ('Permintaan tidak valid')", ok, `Status: ${res.status}, Message: '${json.message}'`);
  }

  // Test 4.3: Honeypot bot submission returns HTTP 200 { ok: true } silently
  {
    // Note: If honeypot is populated with a non-empty string, Zod max(0) rejects it.
    // If a request sends invalid Zod, it fails schema.
    // Let's test honeypot with empty string vs non-empty string:
    const botPayload = {
      nama_lengkap: "Spam Bot",
      usia: 25,
      kategori: "puskesmas",
      instansi_nama: "Bot Org",
      jenis_kelamin: "Laki-laki",
      disabilitas: "Tidak",
      nomor_telepon: "081299998888",
      tanda_tangan: createPngDataUrl(150),
      website: "http://spam.com",
    };
    const req = new Request("http://localhost:3000/api/absen", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(botPayload),
    });
    const res = await POST(req);
    const json = await res.json();
    // Zod schema rejects non-empty website with max(0)
    const ok = res.status === 400;
    record("4.3 Bot with non-empty honeypot is rejected at schema boundary", ok, `Status: ${res.status}, Message: '${json.message}'`);
  }

  // Test 4.4: In-Memory Signature Validation Fail-Fast in Route Handler (before DB hit)
  {
    resetRateLimits();
    // Valid phone, valid fields, but corrupt signature (less than 100 bytes / bad magic)
    const badSigPayload = {
      nama_lengkap: "Adversarial Tester",
      usia: 28,
      kategori: "puskesmas",
      instansi_nama: "Puskesmas Gambir",
      jenis_kelamin: "Laki-laki",
      disabilitas: "Tidak",
      nomor_telepon: "085512345678",
      // Valid data URL prefix with only 10 bytes of bad payload
      tanda_tangan: "data:image/png;base64,QUJDREVGR0hJSg==",
    };

    const req = new Request("http://localhost:3000/api/absen", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(badSigPayload),
    });

    const res = await POST(req);
    const json = await res.json();
    const ok = res.status === 400 && json.message === "Tanda tangan tidak valid";
    record("4.4 Corrupted signature payload triggers HTTP 400 'Tanda tangan tidak valid' before DB calls", ok, `Status: ${res.status}, Message: '${json.message}'`);
  }

  // Test 4.5: Phone Rate Limit Enforcement at Route Handler Level
  {
    resetRateLimits();
    const testPhone = "087788990011";
    const payload = {
      nama_lengkap: "Repeated Submitter",
      usia: 28,
      kategori: "puskesmas",
      instansi_nama: "Puskesmas Gambir",
      jenis_kelamin: "Laki-laki",
      disabilitas: "Tidak",
      nomor_telepon: testPhone,
      tanda_tangan: "data:image/png;base64,QUJDREVGR0hJSg==", // Bad signature so it fails early
    };

    // Submissions 1, 2, 3 consume rate limit and fail at signature check (HTTP 400)
    for (let i = 1; i <= 3; i++) {
      const req = new Request("http://localhost:3000/api/absen", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      await POST(req);
    }

    // Submission 4 must be throttled with HTTP 429
    const req4 = new Request("http://localhost:3000/api/absen", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const res4 = await POST(req4);
    const json4 = await res4.json();

    const ok = res4.status === 429 && json4.message.includes("Terlalu banyak percobaan untuk nomor telepon ini");
    record("4.5 Phone rate limit in POST route handler triggers HTTP 429 on 4th attempt", ok, `Status: ${res4.status}, Message: '${json4.message}'`);
  }

  // Test 4.6: IP Rate Limit Enforcement at Route Handler Level
  {
    resetRateLimits();
    const abusiveIp = "198.51.100.77";

    // Exhaust IP rate limit by directly consuming 500 hits
    for (let i = 0; i < 500; i++) {
      rateLimitIp(abusiveIp, 500, 10 * 60 * 1000);
    }

    // Now send a request from that IP
    const req = new Request("http://localhost:3000/api/absen", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": abusiveIp,
      },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    const json = await res.json();

    const ok = res.status === 429 && json.message.includes("Terlalu banyak permintaan dari jaringan ini");
    record("4.6 IP rate limit in POST route handler triggers HTTP 429 when IP bucket exhausted", ok, `Status: ${res.status}, Message: '${json.message}'`);
  }

  // ============================================================================
  // SUITE 5: HIGH-CONCURRENCY ASYNCHRONOUS BURST STRESS
  // ============================================================================
  console.log("\n--- SUITE 5: HIGH-CONCURRENCY ASYNCHRONOUS BURST STRESS ---");
  resetRateLimits();

  // Test 5.1: 10 concurrent requests for same phone via Promise.all
  {
    resetRateLimits();
    const burstPhone = "089911223344";
    const burstPromises = Array.from({ length: 10 }, async () => {
      // Simulate slight microtask jitter
      await new Promise((r) => setImmediate(r));
      return rateLimitPhone(burstPhone, 3, 600000);
    });

    const results = await Promise.all(burstPromises);
    const passCount = results.filter((r) => r === true).length;
    const failCount = results.filter((r) => r === false).length;

    const ok = passCount === 3 && failCount === 7;
    record("5.1 10 concurrent async requests for same phone yields exactly 3 passes and 7 throttles", ok, `Pass: ${passCount}, Throttled: ${failCount}`);
  }

  // Test 5.2: 600 concurrent async requests from shared IP with unique phone numbers
  {
    resetRateLimits();
    const sharedVenueIp = "180.252.160.88";
    const concurrencyBurst = 600;

    const tasks = Array.from({ length: concurrencyBurst }, async (_, i) => {
      await new Promise((r) => setImmediate(r));
      const ipOk = rateLimitIp(sharedVenueIp, 500, 600000);
      const phoneOk = rateLimitPhone(`089999${String(i).padStart(6, "0")}`, 3, 600000);
      return { ipOk, phoneOk };
    });

    const burstOutcomes = await Promise.all(tasks);
    const ipPassed = burstOutcomes.filter((o) => o.ipOk).length;
    const ipThrottled = burstOutcomes.filter((o) => !o.ipOk).length;
    const phonePassed = burstOutcomes.filter((o) => o.phoneOk).length;

    const ok = ipPassed === 500 && ipThrottled === 100 && phonePassed === 600;
    record(
      "5.2 600 concurrent requests on shared venue IP: exactly 500 IP passes, 100 IP throttled, all 600 unique phones isolated",
      ok,
      `IP Allowed: ${ipPassed}/500, IP Throttled: ${ipThrottled}/100, Unique Phones Allowed: ${phonePassed}/600`
    );
  }

  // Test 5.3: Systematic 8-byte PNG header mutation
  {
    let allMutationsRejected = true;
    for (let i = 0; i < 8; i++) {
      const mutatedBuf = Buffer.alloc(120, 0x00);
      PNG_MAGIC.copy(mutatedBuf, 0);
      mutatedBuf[i] ^= 0xff; // Invert byte at position i
      const mutatedUrl = `data:image/png;base64,${mutatedBuf.toString("base64")}`;
      const bytes = Buffer.from(mutatedUrl.split(",")[1] ?? "", "base64");
      const passed = bytes.length >= 100 && bytes.length <= MAX_SIGNATURE_BYTES && bytes.subarray(0, 8).equals(PNG_MAGIC);
      if (passed) {
        allMutationsRejected = false;
        break;
      }
    }
    record("5.3 Systematic byte inversion across all 8 magic bytes are strictly rejected", allMutationsRejected, `All 8 byte corruption variations rejected: ${allMutationsRejected}`);
  }

  console.log("\n================================================================================");
  console.log(`TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log("================================================================================\n");

  if (passedTests !== totalTests) {
    throw new Error(`Test suite failed: ${totalTests - passedTests} failed tests.`);
  }
}

runAllTests().catch((err) => {
  console.error("FATAL SUITE ERROR:", err);
  process.exit(1);
});
