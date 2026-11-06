/**
 * Arkiv Rabdi Live Integration Test
 *
 * Run from repo root:
 *   node --env-file=.env node_modules/.bin/tsx arkiv-integration-test.ts
 *
 * Steps:
 *  1. Verify wallet address derived from ARKIV_ARCHIVER_PRIVATE_KEY
 *  2. Connect to Rabdi via access key
 *  3. Check tGLM balance
 *  4. Write one test entity (callledger.archived_x_post.v1)
 *  5. Wait for confirmation
 *  6. Print txHash + entityKey
 *  7. Read entity back from Arkiv
 *  8. Verify round-trip data integrity
 */

import {
  ExpirationTime,
  bool,
  createPublicClient,
  createWalletClient,
  defineSchema,
  str,
  u64,
} from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { and, eq } from "@arkiv-network/sdk/query";
import { http, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// ─── Config ────────────────────────────────────────────────────────────────

const EXPECTED_ADDRESS = "0xf033b169c20df54ec1c2d8292a846c4921a4247d";
const PRIVATE_KEY = process.env.ARKIV_ARCHIVER_PRIVATE_KEY ?? "";
const ACCESS_KEY  = process.env.ARKIV_ACCESS_KEY ?? "";
const RPC_URL     = process.env.ARKIV_RPC_URL ?? "";

function fail(msg: string): never {
  console.error("\n❌ FAIL:", msg);
  process.exit(1);
}
const pass = (label: string) => console.log("✅ " + label);
const info = (label: string) => console.log("    " + label);

// ─── Schema (exact mirror of packages/arkiv/src/index.ts) ─────────────────

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
    "  Add: ARKIV_ARCHIVER_PRIVATE_KEY=0x<your-64-hex-char-key>\n" +
    "  Expected wallet: " + EXPECTED_ADDRESS
  );
}
if (!ACCESS_KEY) fail("ARKIV_ACCESS_KEY is not set in .env.");
if (!RPC_URL)    fail("ARKIV_RPC_URL is not set in .env.");

// ── Step 1: Derive + verify address ────────────────────────────────────────
console.log("STEP 1 — Derive wallet address from private key");

let account: ReturnType<typeof privateKeyToAccount>;
try {
  account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
} catch (e: unknown) {
  fail("privateKeyToAccount() threw: " + (e instanceof Error ? e.message : String(e)));
}

info("Derived  : " + account.address);
info("Expected : " + EXPECTED_ADDRESS);

if (account.address.toLowerCase() !== EXPECTED_ADDRESS.toLowerCase()) {
  fail(
    "Address mismatch!\n" +
    "  Derived  : " + account.address + "\n" +
    "  Expected : " + EXPECTED_ADDRESS + "\n" +
    "  Check that ARKIV_ARCHIVER_PRIVATE_KEY matches the funded wallet."
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

let balance: bigint;
try {
  balance = await publicClient.getBalance({ address: account.address });
} catch (e: unknown) {
  fail("publicClient.getBalance() threw:\n  " + (e instanceof Error ? e.message : String(e)));
}

const tGLM = formatUnits(balance, 18);
info("Address : " + account.address);
info("Balance : " + tGLM + " tGLM");

if (balance === 0n) {
  fail("Wallet balance is 0 tGLM — fund at https://hub.arkiv.network/faucet before retrying.");
}
pass("Balance confirmed: " + tGLM + " tGLM — sufficient for a test write");

// ── Step 4: Dedup guard ─────────────────────────────────────────────────────
console.log("\nSTEP 4 — Pre-write deduplication check");

const TEST_SOURCE_POST_ID = "callledger-integration-test-001";
let existingEntityKey: string | null = null;

try {
  const dupCheck = await publicClient
    .select({ $key: true } as const)
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
} catch (e: unknown) {
  info("Dedup query error (non-fatal): " + (e instanceof Error ? e.message : String(e)));
}

if (existingEntityKey) {
  info("Entity already exists from a prior run: " + existingEntityKey);
  info("Skipping write — proceeding to read-back verification.");
} else {
  pass("No duplicate found — proceeding with write");
}

// ── Step 5: Write entity ────────────────────────────────────────────────────
let entityKey: string;
let txHash: string;
let expiresAt: Date | null;

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
      "This entity verifies the archiver wallet can create entities " +
      "on Rabdi using the callledger.archived_x_post.v1 schema."
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
  info("Submitting transaction (may take 10-30s on Rabdi testnet)...");

  let result: { entityKey: string; txHash: string };
  try {
    result = await walletClient.createEntity(ArchivedXPostSchema, payload, { expiration });
  } catch (e: unknown) {
    const msg  = e instanceof Error ? e.message : String(e);
    const cause = (e as { cause?: unknown }).cause;
    const detail = cause ? "\n  cause: " + String(cause) : "";
    fail("walletClient.createEntity() threw:\n  " + msg + detail);
  }

  entityKey = result.entityKey;
  txHash    = result.txHash;

  pass("Transaction confirmed");
  info("txHash    : " + txHash);
  info("entityKey : " + entityKey);
  info("expiresAt : " + expiresAt.toISOString());

} else {
  console.log("\nSTEP 5 — SKIPPED (entity already on-chain)");
  entityKey = existingEntityKey;
  txHash    = "(from previous run)";
  expiresAt = null;
  pass("Using existing entityKey: " + entityKey);
}

// ── Step 6: Summary ─────────────────────────────────────────────────────────
console.log("\nSTEP 6 — Transaction summary");
info("txHash    : " + txHash);
info("entityKey : " + entityKey);
info("expiresAt : " + (expiresAt ? expiresAt.toISOString() : "(check Rabdi explorer)"));

// ── Step 7: Read back ───────────────────────────────────────────────────────
console.log("\nSTEP 7 — Read entity back from Arkiv");

let entity: Record<string, { value?: unknown }> | null;
try {
  entity = await publicClient.getEntity(entityKey as `0x${string}`, ArchivedXPostSchema) as Record<string, { value?: unknown }> | null;
} catch (e: unknown) {
  fail("publicClient.getEntity() threw:\n  " + (e instanceof Error ? e.message : String(e)));
}

if (!entity) {
  fail("getEntity() returned null — entity not found after write.\nThe transaction may not have confirmed yet; retry in a few seconds.");
}
pass("Entity retrieved successfully from Arkiv");

// ── Step 8: Round-trip verification ─────────────────────────────────────────
console.log("\nSTEP 8 — Round-trip data verification");

let allMatch = true;
function check(field: string, expected: string, actual: unknown) {
  const match = String(actual ?? "").toLowerCase() === expected.toLowerCase();
  if (match) {
    pass(field.padEnd(22) + "✓  \"" + actual + "\"");
  } else {
    console.error("❌ MISMATCH — " + field);
    console.error("   expected : " + expected);
    console.error("   got      : " + actual);
    allMatch = false;
  }
}

check("sourcePlatform",   "x",                  entity.sourcePlatform?.value);
check("sourcePostId",     TEST_SOURCE_POST_ID,  entity.sourcePostId?.value);
check("authorUsername",   "callledger_testbot", entity.authorUsername?.value);
check("contentFidelity",  "VERBATIM",           entity.contentFidelity?.value);
check("captureProvider",  "integration-test",   entity.captureProvider?.value);
check("tradingRelated",   "false",              String(entity.tradingRelated?.value));
check("schemaVersion",    "1",                  entity.schemaVersion?.value);

let topicsParsed: string[] = [];
try {
  topicsParsed = JSON.parse(String(entity.topics?.value ?? "[]")) as string[];
} catch (_) { /* ignore */ }

if (topicsParsed.includes("integration-test") && topicsParsed.includes("callledger")) {
  pass("topics".padEnd(22) + "✓  " + entity.topics?.value);
} else {
  console.error("❌ MISMATCH — topics");
  console.error("   expected : [\"integration-test\",\"callledger\",\"arkiv\"]");
  console.error("   got      : " + entity.topics?.value);
  allMatch = false;
}

// ── Final ─────────────────────────────────────────────────────────────────
console.log("\n══════════════════════════════════════════════════════");
if (!allMatch) {
  console.log("   ❌ INTEGRATION TEST FAILED — data mismatch above");
  process.exit(1);
} else {
  console.log("   ✅ INTEGRATION TEST PASSED — full round-trip verified");
  console.log("");
  console.log("   txHash    : " + txHash);
  console.log("   entityKey : " + entityKey);
  console.log("");
  console.log("   Arkiv write + read pipeline is fully operational.");
  console.log("   The monitoring worker archiver is ready to run.");
}
console.log("══════════════════════════════════════════════════════\n");
