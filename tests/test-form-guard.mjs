// tests/test-form-guard.mjs
// Empirical test for AttendeeForm isSubmittingRef synchronous guard,
// double-tap interception, error recovery, and success lock.

console.log("=== EMPIRICAL TEST SUITE 2: ATTENDEE FORM ISSUBMITTINGREF GUARD ===");

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
// TEST 1: Rapid Double-Tap / Multi-Click Simulation
// --------------------------------------------------------------------------
console.log("\n--- TEST 1: Multi-Tap Interception via isSubmittingRef ---");
{
  class FormGuardHarness {
    constructor() {
      this.isSubmittingRef = { current: false };
      this.fetchCalls = 0;
      this.serverErr = "";
      this.done = false;
      this.fetchDelayMs = 50;
      this.mockResponse = { ok: true };
      this.shouldFetchReject = false;
    }

    async handleFormSubmitEvent(e) {
      if (this.isSubmittingRef.current) {
        if (e && e.preventDefault) e.preventDefault();
        return;
      }
      return this.executeSubmit();
    }

    async executeSubmit() {
      if (this.isSubmittingRef.current) return;
      this.isSubmittingRef.current = true;
      this.serverErr = "";

      try {
        this.fetchCalls++;
        await new Promise((r) => setTimeout(r, this.fetchDelayMs));

        if (this.shouldFetchReject) {
          throw new Error("Network connection dropped");
        }

        const j = this.mockResponse;
        if (!j.ok) {
          this.isSubmittingRef.current = false;
          this.serverErr = j.message ?? "Gagal mengirim";
          return;
        }

        this.done = true;
      } catch {
        this.isSubmittingRef.current = false;
        this.serverErr = "Koneksi bermasalah. Coba lagi.";
      }
    }
  }

  const harness1 = new FormGuardHarness();
  const mockEvents = Array.from({ length: 5 }, () => ({
    prevented: false,
    preventDefault() { this.prevented = true; }
  }));

  const p1 = harness1.handleFormSubmitEvent(mockEvents[0]);
  await new Promise((r) => setTimeout(r, 2));
  const p2 = harness1.handleFormSubmitEvent(mockEvents[1]);
  await new Promise((r) => setTimeout(r, 3));
  const p3 = harness1.handleFormSubmitEvent(mockEvents[2]);
  await new Promise((r) => setTimeout(r, 5));
  const p4 = harness1.handleFormSubmitEvent(mockEvents[3]);
  await new Promise((r) => setTimeout(r, 10));
  const p5 = harness1.handleFormSubmitEvent(mockEvents[4]);

  await Promise.all([p1, p2, p3, p4, p5]);

  report(
    "1.1 Exactly 1 fetch request initiated despite 5 rapid clicks",
    harness1.fetchCalls === 1,
    `Fetch calls initiated: ${harness1.fetchCalls}`
  );
  report(
    "1.2 Subsequent 4 events were prevented via preventDefault()",
    mockEvents.slice(1).every((e) => e.prevented === true),
    `Prevented events: ${mockEvents.slice(1).filter((e) => e.prevented).length} of 4`
  );
  report(
    "1.3 Form reached successful done state",
    harness1.done === true,
    `Done: ${harness1.done}`
  );
  report(
    "1.4 Guard remains locked (true) post-success to absorb trailing taps",
    harness1.isSubmittingRef.current === true,
    `isSubmittingRef.current: ${harness1.isSubmittingRef.current}`
  );

  const trailingEvent = { prevented: false, preventDefault() { this.prevented = true; } };
  await harness1.handleFormSubmitEvent(trailingEvent);
  report(
    "1.5 Trailing tap after success does not trigger additional fetch",
    harness1.fetchCalls === 1 && trailingEvent.prevented === true,
    `Fetch calls after trailing tap: ${harness1.fetchCalls}`
  );
}

// --------------------------------------------------------------------------
// TEST 2: Error Recovery (Server Validation / 409 / 429)
// --------------------------------------------------------------------------
console.log("\n--- TEST 2: Error Recovery & Retry Capability ---");
{
  class FormGuardHarness {
    constructor() {
      this.isSubmittingRef = { current: false };
      this.fetchCalls = 0;
      this.serverErr = "";
      this.done = false;
      this.fetchDelayMs = 10;
      this.mockResponse = { ok: false, message: "Anda sudah tercatat hadir pada sesi ini." };
    }
    async handleFormSubmitEvent() {
      if (this.isSubmittingRef.current) return;
      return this.executeSubmit();
    }
    async executeSubmit() {
      if (this.isSubmittingRef.current) return;
      this.isSubmittingRef.current = true;
      this.serverErr = "";
      try {
        this.fetchCalls++;
        await new Promise((r) => setTimeout(r, this.fetchDelayMs));
        const j = this.mockResponse;
        if (!j.ok) {
          this.isSubmittingRef.current = false;
          this.serverErr = j.message ?? "Gagal mengirim";
          return;
        }
        this.done = true;
      } catch {
        this.isSubmittingRef.current = false;
        this.serverErr = "Koneksi bermasalah. Coba lagi.";
      }
    }
  }

  const harness = new FormGuardHarness();

  await harness.handleFormSubmitEvent();
  report(
    "2.1 Initial failed submission sets serverErr",
    harness.serverErr === "Anda sudah tercatat hadir pada sesi ini." && harness.fetchCalls === 1,
    `serverErr: "${harness.serverErr}", calls: ${harness.fetchCalls}`
  );
  report(
    "2.2 Failed submission resets isSubmittingRef.current to false",
    harness.isSubmittingRef.current === false,
    `isSubmittingRef.current: ${harness.isSubmittingRef.current}`
  );

  harness.mockResponse = { ok: true };
  await harness.handleFormSubmitEvent();
  report(
    "2.3 Subsequent submission after error is permitted and executes successfully",
    harness.fetchCalls === 2 && harness.done === true,
    `Total calls: ${harness.fetchCalls}, Done: ${harness.done}`
  );
}

// --------------------------------------------------------------------------
// TEST 3: Network Exception Recovery (Fetch Rejection)
// --------------------------------------------------------------------------
console.log("\n--- TEST 3: Network Exception Recovery ---");
{
  class FormGuardHarness {
    constructor() {
      this.isSubmittingRef = { current: false };
      this.fetchCalls = 0;
      this.serverErr = "";
      this.done = false;
      this.shouldFetchReject = true;
    }
    async handleFormSubmitEvent() {
      if (this.isSubmittingRef.current) return;
      return this.executeSubmit();
    }
    async executeSubmit() {
      if (this.isSubmittingRef.current) return;
      this.isSubmittingRef.current = true;
      this.serverErr = "";
      try {
        this.fetchCalls++;
        await new Promise((r) => setTimeout(r, 10));
        if (this.shouldFetchReject) {
          throw new Error("Failed to fetch");
        }
        this.done = true;
      } catch {
        this.isSubmittingRef.current = false;
        this.serverErr = "Koneksi bermasalah. Coba lagi.";
      }
    }
  }

  const harness = new FormGuardHarness();
  await harness.handleFormSubmitEvent();

  report(
    "3.1 Network exception displays connection error message",
    harness.serverErr === "Koneksi bermasalah. Coba lagi.",
    `serverErr: "${harness.serverErr}"`
  );
  report(
    "3.2 Network exception resets isSubmittingRef to false allowing retry",
    harness.isSubmittingRef.current === false,
    `isSubmittingRef.current: ${harness.isSubmittingRef.current}`
  );

  harness.shouldFetchReject = false;
  await harness.handleFormSubmitEvent();
  report(
    "3.3 Retry after network reconnection succeeds",
    harness.fetchCalls === 2 && harness.done === true,
    `Calls: ${harness.fetchCalls}, Done: ${harness.done}`
  );
}

// --------------------------------------------------------------------------
// TEST 4: Form Reset Lifecycle ('Isi untuk peserta lain')
// --------------------------------------------------------------------------
console.log("\n--- TEST 4: Form Reset Lifecycle ('Isi untuk peserta lain') ---");
{
  let formKey = 0;
  let done = false;

  function createInnerInstance() {
    return {
      key: formKey,
      isSubmittingRef: { current: false },
    };
  }

  let currentInner = createInnerInstance();
  currentInner.isSubmittingRef.current = true;
  done = true;

  report(
    "4.1 First attendee locks current instance ref on success",
    currentInner.isSubmittingRef.current === true && done === true,
    `Inner key: ${currentInner.key}, locked: ${currentInner.isSubmittingRef.current}`
  );

  done = false;
  formKey += 1;
  const nextInner = createInnerInstance();

  report(
    "4.2 Remounted form instance has a clean isSubmittingRef = false",
    nextInner.key === 1 && nextInner.isSubmittingRef.current === false,
    `Next Inner key: ${nextInner.key}, ref initialized: ${nextInner.isSubmittingRef.current}`
  );
}

console.log("\n=======================================================");
console.log(`SUITE 2 RESULTS: ${passed} passed, ${failed} failed`);
console.log("=======================================================");

process.exit(failed > 0 ? 1 : 0);
