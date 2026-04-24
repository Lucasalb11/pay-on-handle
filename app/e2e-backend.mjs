#!/usr/bin/env node
/**
 * E2E backend test — hit the local Next.js API routes with real HTTP requests.
 * Run:  node e2e-backend.mjs
 * Env:  BASE_URL=http://localhost:3000 (default)
 *
 * Does NOT submit transactions to the chain — only verifies that routes
 * build correct responses and return properly serialised data.
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

// Fixed devnet wallet that we use as sender/registrant.
// It does not need SOL — we only build txs, never submit them.
const TEST_SENDER = "GfPESpzMYrw1fz4jH58ynpsMYeutXfBzmh2CXYY5Whuk";
const TEST_HANDLE = "pagonoarroba_test";
const TEST_PLATFORM = 1; // Twitter

// ────────────────────────── helpers ──────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function ok(label, value, expected) {
  if (value === expected || (expected === undefined && value)) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}  →  got ${JSON.stringify(value)}, want ${JSON.stringify(expected)}`);
    failed++;
    failures.push(label);
  }
}

function assert(label, cond, detail = "") {
  if (cond) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}${detail ? `  →  ${detail}` : ""}`);
    failed++;
    failures.push(label);
  }
}

async function api(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, opts);
  let json;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json };
}

function isBase64(str) {
  return typeof str === "string" && /^[A-Za-z0-9+/]+=*$/.test(str) && str.length > 64;
}

// ────────────────────────── tests ──────────────────────────

async function testPrices() {
  console.log("\n── GET /api/prices");
  const { status, json } = await api("GET", "/api/prices");
  ok("status 200", status, 200);
  assert("sol_usd is a positive number", typeof json?.sol_usd === "number" && json.sol_usd > 0, `sol_usd=${json?.sol_usd}`);
  assert("sol_brl is a positive number", typeof json?.sol_brl === "number" && json.sol_brl > 0, `sol_brl=${json?.sol_brl}`);
  ok("usdc_usd present", typeof json?.usdc_usd === "number", true);
  ok("updated_at present", typeof json?.updated_at === "number", true);
}

async function testSendErrors() {
  console.log("\n── POST /api/send — validation errors");

  const { status: s1 } = await api("POST", "/api/send", {});
  ok("missing fields → 400", s1, 400);

  const { status: s2, json: j2 } = await api("POST", "/api/send", {
    sender: TEST_SENDER, platform: 1, handle: TEST_HANDLE, amountSol: 0.01,
  });
  // This may fail if VaultConfig is not initialized (Solana error), but the route
  // should not return 4xx for a structurally valid request unless chain reachability fails.
  // We accept either 200 (happy) or 500 (chain error while building tx).
  assert(
    "valid request → not 400/404",
    s2 !== 400 && s2 !== 404,
    `status=${s2} body=${JSON.stringify(j2)}`
  );

  const { status: s3, json: j3 } = await api("POST", "/api/send", {
    sender: TEST_SENDER, platform: 5, handle: TEST_HANDLE, amountSol: 0.01,
  });
  ok("invalid platform → 400", s3, 400);

  const { status: s4 } = await api("POST", "/api/send", {
    sender: "not-a-key", platform: 1, handle: TEST_HANDLE, amountSol: 0.01,
  });
  ok("invalid pubkey → 400", s4, 400);

  const { status: s5 } = await api("POST", "/api/send", {
    sender: TEST_SENDER, platform: 1, handle: TEST_HANDLE,
    // no amountSol or amountUsdc
  });
  ok("missing amount → 400", s5, 400);
}

async function testSendHappyPath() {
  console.log("\n── POST /api/send (SOL) — happy path");
  const { status, json } = await api("POST", "/api/send", {
    sender: TEST_SENDER,
    platform: TEST_PLATFORM,
    handle: TEST_HANDLE,
    amountSol: 0.01,
  });

  if (status === 200) {
    ok("status 200", status, 200);
    assert("transaction is base64", isBase64(json?.transaction), `len=${json?.transaction?.length}`);
    assert("vault is a pubkey (base58, 32–44 chars)", typeof json?.vault === "string" && json.vault.length >= 32, `vault=${json?.vault}`);
    assert("nonce is a string", typeof json?.nonce === "string", `nonce=${json?.nonce}`);
    assert("netAmount is a string (lamports)", typeof json?.netAmount === "string", `netAmount=${json?.netAmount}`);
    assert("feeAmount is a string (lamports)", typeof json?.feeAmount === "string", `feeAmount=${json?.feeAmount}`);
    ok("expiresInDays = 7", json?.expiresInDays, 7);

    // Validate fee math: fee = 0.5% of gross, net = gross - fee
    const gross = Math.round(0.01 * 1e9);
    const expectedFee = Math.floor((gross * 50) / 10_000);
    const expectedNet = gross - expectedFee;
    ok("feeAmount correct (0.5%)", json?.feeAmount, String(expectedFee));
    ok("netAmount correct", json?.netAmount, String(expectedNet));

    return json?.vault;
  } else {
    // If Vault Config not initialized this will be a program error (500).
    // Log the body so the user knows why, but don't hard-fail the suite.
    console.log(`  ⚠  status ${status} — ${json?.error ?? JSON.stringify(json)}`);
    console.log("     (VaultConfig may not be initialized on devnet — run scripts/initialize.ts)");
    return null;
  }
}

async function testVaultRead(vaultAddress) {
  console.log("\n── GET /api/vault/[vaultId]");

  // Invalid address format
  const { status: s1, json: j1 } = await api("GET", "/api/vault/not-a-valid-pubkey");
  ok("invalid address → 400", s1, 400);

  // Valid base58 but non-existent vault
  const nonexistent = "11111111111111111111111111111111";
  const { status: s2, json: j2 } = await api("GET", `/api/vault/${nonexistent}`);
  // SystemProgram address is not owned by vault program → 404
  ok("nonexistent vault → 404", s2, 404);

  // If we have a real vault from a previous send, read it
  if (vaultAddress) {
    const { status: s3, json: j3 } = await api("GET", `/api/vault/${vaultAddress}`);
    // vault PDA derived off-chain but tx never submitted → not on chain → 404 is expected
    // But if by chance it exists (reused sender), we check the shape.
    if (s3 === 200) {
      assert("vault has status field", ["pending","claimed","refunded","expired"].includes(j3?.status), `status=${j3?.status}`);
      assert("vault has sender", typeof j3?.sender === "string", `sender=${j3?.sender}`);
      assert("vault has amount (lamports)", typeof j3?.amount === "number", `amount=${j3?.amount}`);
      assert("vault has expiresAt", typeof j3?.expiresAt === "number", `expiresAt=${j3?.expiresAt}`);
      console.log(`  ✓ vault exists on-chain: status=${j3?.status}, amount=${j3?.amount} lamports`);
    } else {
      console.log(`  ℹ vault not on-chain (tx was not submitted) — status=${s3}`);
    }
  }
}

async function testRegisterHandle() {
  console.log("\n── POST /api/register-handle");

  // Missing fields
  const { status: s1 } = await api("POST", "/api/register-handle", {});
  ok("missing fields → 400", s1, 400);

  // Invalid platform
  const { status: s2 } = await api("POST", "/api/register-handle", {
    walletAddress: TEST_SENDER, platform: 9, handle: TEST_HANDLE,
  });
  ok("invalid platform → 400", s2, 400);

  // Happy path — returns tx (user signs) or alreadyRegistered if handle already on-chain
  const { status: s3, json: j3 } = await api("POST", "/api/register-handle", {
    walletAddress: TEST_SENDER,
    platform: TEST_PLATFORM,
    handle: TEST_HANDLE,
  });
  ok("valid request → 200", s3, 200);
  ok("ok=true", j3?.ok, true);
  assert("handleRecord is a pubkey", typeof j3?.handleRecord === "string" && j3.handleRecord.length >= 32, `handleRecord=${j3?.handleRecord}`);
  assert("handleHash is 64-char hex", typeof j3?.handleHash === "string" && j3.handleHash.length === 64, `handleHash=${j3?.handleHash}`);

  if (j3?.alreadyRegistered) {
    console.log("  ℹ handle already registered on-chain — no tx returned (idempotent)");
  } else {
    assert("transaction is base64", isBase64(j3?.transaction), `len=${j3?.transaction?.length}`);
    console.log("  ℹ handle not yet registered — tx returned for user to sign");
  }
}

async function testClaimErrors() {
  console.log("\n── POST /api/claim — validation errors");

  const { status: s1 } = await api("POST", "/api/claim", {});
  ok("missing fields → 400", s1, 400);

  const { status: s2 } = await api("POST", "/api/claim", {
    claimant: "bad-key", vaultId: "bad-key", handle: TEST_HANDLE,
  });
  ok("invalid pubkeys → 400", s2, 400);

  const nonexistent = "11111111111111111111111111111111";
  const { status: s3 } = await api("POST", "/api/claim", {
    claimant: TEST_SENDER,
    vaultId: nonexistent,
    handle: TEST_HANDLE,
  });
  ok("nonexistent vault → 404", s3, 404);
}

async function testJupiterProxy() {
  console.log("\n── GET /api/jupiter (proxy sanity check)");
  const SOL_MINT = "So11111111111111111111111111111111111111112";
  const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

  // Route should handle errors gracefully — 500 means unhandled exception.
  // 200=quote ok, 4xx=Jupiter rejected params, 503=Jupiter unreachable (network).
  const { status, json } = await api("GET", `/api/jupiter?inputMint=${SOL_MINT}&outputMint=${USDC_MINT}&amount=100000000&slippageBps=50`);
  assert("jupiter proxy responds gracefully (not 500)", status !== 500, `status=${status} body=${JSON.stringify(json)?.slice(0,120)}`);
  if (status === 200) console.log("  ✓ Jupiter quote returned successfully");
  else console.log(`  ℹ Jupiter responded with ${status} (acceptable — API may be rate-limited or unreachable)`);
}

// ────────────────────────── runner ──────────────────────────

async function run() {
  console.log(`\n🧪  Pay on @ — Backend E2E Tests`);
  console.log(`    Target: ${BASE_URL}`);
  console.log(`    Sender: ${TEST_SENDER}\n`);

  // Connectivity check
  try {
    await fetch(`${BASE_URL}/api/prices`);
  } catch (e) {
    console.error(`\n❌  Cannot reach ${BASE_URL} — is the dev server running?\n`);
    console.error("    Run:  npm run dev\n");
    process.exit(1);
  }

  await testPrices();
  await testSendErrors();
  const vaultAddress = await testSendHappyPath();
  await testVaultRead(vaultAddress);
  await testRegisterHandle();
  await testClaimErrors();
  await testJupiterProxy();

  console.log(`\n${"─".repeat(48)}`);
  console.log(`  ${passed} passed  ${failed} failed`);
  if (failures.length) {
    console.log(`\n  Failed checks:`);
    failures.forEach(f => console.log(`    · ${f}`));
  }
  console.log("");
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error("\n💥 Unexpected error:", err);
  process.exit(1);
});
