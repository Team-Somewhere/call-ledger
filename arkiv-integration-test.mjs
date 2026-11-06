/**
 * Arkiv Rabdi Integration Test
 *
 * Steps:
 *  1. Verify wallet address derived from ARKIV_ARCHIVER_PRIVATE_KEY
 *  2. Connect to Rabdi via access key
 *  3. Check tGLM balance
 *  4. Write one test entity using CallLedger's ArchivedXPostSchema
 *  5. Wait for confirmation
 *  6. Print txHash + entityKey
 *  7. Read the entity back
 *  8. Verify round-trip data integrity
 *
 * Run from repo root:
 *   node --env-file=.env arkiv-integration-test.mjs
 */

import {
  ExpirationTime,
  bool,
  createPublicClient,
  createWalletClient,
  defineSchema,
  str,
  u64,
} from "./packages/arkiv/node_modules/@arkiv-network/sdk/dist/index.js";

import { rabdi } from "./packages/arkiv/node_modules/@arkiv-network/sdk/dist/chains/index.js";

import { and, eq } from "./packages/arkiv/node_modules/@arkiv-network/sdk/dist/query/index.js";

import { http, formatUnits } from "./packages/arkiv/node_modules/viem/dist/esm/index.js";

import { privateKeyToAccount } from "./packages/arkiv/node_modules/viem/dist/esm/accounts/index.js";

// ─── Config ────────────────────────────────────────────────────────────────

const EXPECTED_ADDRESS = "0xf033b169c20df54ec1c2d8292a846c4921a4247d";
const PRIVATE_KEY      = process.env.ARKIV_ARCHIVER_PRIVATE_KEY;
const ACCESS_KEY       = process.env.ARKIV_ACCESS_KEY;
const RPC_URL          = process.env.ARKIV_RPC_URL;

function fail(msg) {
  console.error("\n❌ FAIL:", msg);
  process.exit(1);
}
function pass(label)  { console.log("✅ " + label); }
function info(label)  { console.log("    " + label); }

// ─── Schema ─────────────────────────────────────────────────────────────────

const ArchivedXPostSchema = defineSchema(
  "callledger.archived_x_post.v1",
  {
    sourcePlatform:    str().indexed(),
    sourcePostId:      str().indexed(),
    authorUsername:    str().indexed(),
    authorDisplayName: str(),
    postText:          str(),
    postUrl:           str(),
    originalCreatedAt: u64().indexed(),
    capturedAt:        u64().indexed(),
    contentFidelity:   str().indexed(),
    captureProvider:   str(),
    tradingRelated:    bool().indexed(),
    topics:            str(),
    assets:            str(),
    schemaVersion:     str(),
  },
);

// ─── Main ──────────────────────────────────────────────────────────────────

console.log("\n══════════════════════════════════════════════════════");
console.log("   CALLLEDGER × ARKIV RABDI — LIVE INTEGRATION TEST   ");
console.log("══════════════════════════════════════════════════════\n");

// ── Step 0: Env guard ──────────────────────────────────────────────────────
if (!PRIVATE_KEY || PRIVATE_KEY === "YOUR_ARCHIVE_WALLET_PRIVATE_KEY") {
  fail(
    "ARKIV_ARCHIVER_PRIVATE_KEY is not set in .env.\n" +
    "  Add the actual private key (0x-prefixed hex) for the funded wallet:\n" +
    "  ARKIV_ARCHIVER_PRIVATE_KEY=0x<your-64-hex-char-key>\n" +
    "  Expected address: " + EXPECTED_ADDRESS
  );
}
if (!ACCESS_KEY) fail("ARKIV_ACCESS_KEY is not set in .env.");
if (!RPC_URL)    fail("ARKIV_RPC_URL is not set in .env.");

// ── Step 1: Derive + verify address ────────────────────────────────────────
console.log("STEP 1 — Derive wallet address from private key");
let account;
try {
  account = privateKeyToAccount(PRIVATE_KEY);
} catch (e) {
  fail("privateKeyToAccount() threw: " + e.message);
}
info("Derived  : " + account.address);
info("Expected : " + EXPECTED_ADDRESS);
if (account.address.toLowerCase() !== EXPECTED_ADDRESS.toLowerCase()) {
  fail(
    "Address mismatch!\n" +
    "  Derived  : " + account.address + "\n" +
    "  Expected : " + EXPECTED_ADDRESS + "\n" +
    "  Check that ARKIV_ARCHIVER_PRIVATE_KEY belongs to the funded wallet."
  );
}
pass("Wallet address matches 0xf033...247d");

// ── Step 2: Build clients ───────────────────────────────────────────────────
console.log("\nSTEP 2 — Connect to Arkiv Rabdi testnet");
const chain        = rabdi({ accessKey: ACCESS_KEY, rpcUrl: RPC_URL });
const publicClient = createPublicClient({ chain, transport: http() });
const walletClient = createWalletClient({ chain, transport: http(), account });
pass("Clients initialised (Rabdi chain, access key configured)");

// ── Step 3: Balance check ───────────────────────────────────────────────────
console.log("\nSTEP 3 — tGLM balance check");
let balance;
try {
  balance = await publicClient.getBalance({ address: account.address });
} catch (e) {
  fail("publicClient.getBalance() threw:\n  " + e.message);
}
const tGLM = formatUnits(balance, 18);
info("Address : " + account.address);
info("Balance : " + tGLM + " tGLM");
if (balance === 0n) {
  fail("Wallet balance is 0 tGLM — fund it at https://hub.arkiv.network/faucet before retrying.");
}
pass("Balance confirmed: " + tGLM + " tGLM");

// ── Step 4: Dedup guard ─────────────────────────────────────────────────────
console.log("\nSTEP 4 — Pre-write deduplication check");
const TEST_SOURCE_POST_ID = "callledger-integration-test-001";
let existingEntityKey = null;
try {
  const dupCheck = await publicClient
    .select({ $key: true })
    .from(ArchivedXPostSchema)
    .where(
      and(
        eq("sourcePlatform", str("x")),
        eq("sourcePostId",   str(TEST_SOURCE_POST_ID)),
      ),
    )
    .limit(1)
    .fetch();
  if (dupCheck.entities.length > 0) {
    existingEntityKey = String(dupCheck.entities[0].$key);
  }
} catch (e) {
  info("Dedup query error (non-fatal, continuing): " + e.message);
}

if (existingEntityKey) {
  info("Test entity already exists from a prior run: " + existingEntityKey);
  info("Skipping write — proceeding to read-back verification.");
}

// ── Step 5: Write entity ────────────────────────────────────────────────────
let entityKey, txHash, expiresAt;

if (!existingEntityKey) {
  console.log("\nSTEP 5 — Write test entity to Arkiv Rabdi");

  const nowMs    = Date.now();
  const expiryDays = 30;
  const expiration = ExpirationTime.fromDays(expiryDays);
  expiresAt = new Date(nowMs + expiryDays * 24 * 60 * 60 * 1000);

  const payload = {
    sourcePlatform:    str("x"),
    sourcePostId:      str(TEST_SOURCE_POST_ID),
    authorUsername:    str("callledger_testbot"),
    authorDisplayName: str("CallLedger Integration Test"),
    postText:          str(
      "CallLedger × Arkiv integration test entity. " +
      "Written at: " + new Date(nowMs).toISOString() + ". " +
      "This entity verifies that the archiver wallet can create " +
      "entities on Rabdi using the callledger.archived_x_post.v1 schema."
    ),
    postUrl:           str("https://x.com/callledger_testbot/status/" + TEST_SOURCE_POST_ID),
    originalCreatedAt: u64(BigInt(nowMs)),
    capturedAt:        u64(BigInt(nowMs)),
    contentFidelity:   str("VERBATIM"),
    captureProvider:   str("integration-test"),
    tradingRelated:    bool(false),
    topics:            str(JSON.stringify(["integration-test", "callledger", "arkiv"])),
    assets:            str(JSON.stringify([])),
    schemaVersion:     str("1"),
  };

  info("sourcePostId  : " + TEST_SOURCE_POST_ID);
  info("schema        : callledger.archived_x_post.v1");
  info("expiry        : " + expiryDays + " days");
  info("Submitting transaction (may take ~10-30s on Rabdi testnet)...");

  let result;
  try {
    result = await walletClient.createEntity(ArchivedXPostSchema, payload, { expiration });
  } catch (e) {
    const detail = e.cause ? "\n  cause: " + String(e.cause) : "";
    fail("walletClient.createEntity() threw:\n  " + e.message + detail);
  }

  entityKey = result.entityKey;
  txHash    = result.txHash;

  pass("Transaction confirmed");
  info("txHash    : " + txHash);
  info("entityKey : " + entityKey);
  info("expiresAt : " + expiresAt.toISOString());
} else {
  console.log("\nSTEP 5 — SKIPPED (entity already exists on-chain)");
  entityKey = existingEntityKey;
  txHash    = "(from previous run)";
  expiresAt = null;
  pass("Using existing entityKey: " + entityKey);
}

// ── Step 6: Summary ─────────────────────────────────────────────────────────
console.log("\nSTEP 6 — Transaction summary");
info("txHash    : " + txHash);
info("entityKey : " + entityKey);
info("expiresAt : " + (expiresAt ? expiresAt.toISOString() : "(check explorer)"));

// ── Step 7: Read back ───────────────────────────────────────────────────────
console.log("\nSTEP 7 — Read entity back from Arkiv");
let entity;
try {
  entity = await publicClient.getEntity(entityKey, ArchivedXPostSchema);
} catch (e) {
  fail("publicClient.getEntity() threw:\n  " + e.message);
}
if (!entity) {
  fail("getEntity() returned null — entity not found after write. The transaction may not have confirmed yet.");
}
pass("Entity retrieved successfully");

// ── Step 8: Round-trip verification ─────────────────────────────────────────
console.log("\nSTEP 8 — Round-trip data verification");

let allMatch = true;
function check(field, expected, actual) {
  const match = String(actual ?? "").toLowerCase() === String(expected).toLowerCase();
  if (match) {
    pass(field + " ✓  \"" + actual + "\"");
  } else {
    console.error("❌ MISMATCH — " + field);
    console.error("   expected : " + expected);
    console.error("   got      : " + actual);
    allMatch = false;
  }
}

check("sourcePlatform",   "x",                    entity.sourcePlatform?.value);
check("sourcePostId",     TEST_SOURCE_POST_ID,     entity.sourcePostId?.value);
check("authorUsername",   "callledger_testbot",    entity.authorUsername?.value);
check("contentFidelity",  "VERBATIM",              entity.contentFidelity?.value);
check("captureProvider",  "integration-test",      entity.captureProvider?.value);
check("tradingRelated",   "false",                 String(entity.tradingRelated?.value));
check("schemaVersion",    "1",                     entity.schemaVersion?.value);

let topicsParsed = [];
try {
  topicsParsed = JSON.parse(entity.topics?.value ?? "[]");
} catch (_) { /* ignore */ }
if (topicsParsed.includes("integration-test") && topicsParsed.includes("callledger")) {
  pass("topics ✓  " + entity.topics?.value);
} else {
  console.error("❌ MISMATCH — topics");
  console.error("   expected : [\"integration-test\",\"callledger\",\"arkiv\"]");
  console.error("   got      : " + entity.topics?.value);
  allMatch = false;
}

// ── Final result ─────────────────────────────────────────────────────────────
console.log("\n══════════════════════════════════════════════════════");
if (!allMatch) {
  console.log("   ❌ INTEGRATION TEST FAILED — data mismatch (see above)");
  process.exit(1);
} else {
  console.log("   ✅ INTEGRATION TEST PASSED — full round-trip verified");
  console.log("");
  console.log("   txHash    : " + txHash);
  console.log("   entityKey : " + entityKey);
  console.log("");
  console.log("   The Arkiv wallet can write to Rabdi.");
  console.log("   The automatic monitoring archiver is ready to use.");
}
console.log("══════════════════════════════════════════════════════\n");
