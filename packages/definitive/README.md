# @call-ledger/definitive

Production integration client and verified types for **Definitive Flash** trade execution and order lifecycle tracking.

## Official Documentation & Verified API Assumptions

Source of Truth:
- Official Documentation: [https://flash.definitive.fi/docs](https://flash.definitive.fi/docs)
- Machine-Readable Spec: [https://flash.definitive.fi/docs/openapi.json](https://flash.definitive.fi/docs/openapi.json)
- LLMs Index: [https://flash.definitive.fi/docs/llms.txt](https://flash.definitive.fi/docs/llms.txt)

### 1. Base URL & Authentication
- **Base URL**: `https://flash.definitive.fi/v1`
- **Auth Header**: `x-definitive-api-key: <DEFINITIVE_API_KEY>`
- **Security Constraint**: The API key is strictly server-side (`apps/api` environment). It is **never** exposed as `NEXT_PUBLIC_*` or packaged into the Chrome extension bundle.

### 2. Endpoints & Request/Response Contracts

#### A. Price Quote & Signable Payload (`POST /v1/quote`)
- **Purpose**: Retrieves optimal routing, fee breakdowns, output quantities, and the source-chain signable payload (EIP-712 typed data for EVM).
- **Core Parameters**:
  - `targetChain`: Destination blockchain (e.g. `"base"`, `"ethereum"`, `"arbitrum"`).
  - `contraChain`: Source blockchain (matches `targetChain` for single-chain swaps).
  - `targetAsset`: Contract address of the received asset (e.g., WETH `0x4200000000000000000000000000000000000006` on Base).
  - `contraAsset`: Contract address of the spent asset (e.g., USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` on Base).
  - `side`: Trade direction: `"buy"` or `"sell"`.
  - `qty`: Decimal token quantity string of the spent asset (`contraAsset` on buy, `targetAsset` on sell).
  - `orderType`: `"limit"` (advanced order priority for hackathon demo) or `"market"`.
  - `limitNotionalPrice`: USD target price for limit execution (e.g. `"2400"`).
  - `funderAddress`: The user's wallet address funding and signing the order.
  - `flashIntegratorFeeBps`: Optional integrator revenue share in basis points (e.g., `"50"`). Must match between `/quote` and `/order`.
  - `expireTime`: Optional ISO-8601 timestamp for Good-Til-Time (GTT).
- **Response**:
  - `quoteId`: Unique identifier for locking execution routing.
  - `evm.orderTypedData`: Complete EIP-712 typed data (`domain`, `types`, `primaryType`, `message`) passed directly to `eth_signTypedData_v4`.
  - `expectedOutputAmount`: Estimated token quantity received.
  - `fees`: Protocol and integrator fee structure.
  - `validUntil`: Quote expiration timestamp.

#### B. Order Submission (`POST /v1/order`)
- **Purpose**: Submits the user-signed cryptographic payload to Definitive's execution engine.
- **Parameters**:
  - Mirrors quote parameters + `quoteId`, `funderAddress`, and `userSignature` (0x-prefixed hex string from wallet).
  - `evmOrderTypedData`: The exact EIP-712 typed data signed by the user.
- **Idempotency Rule**: Order submission is state-changing and is **never** blindly retried on network failure. Reconcile via status lookup before re-quoting.

#### C. Order Status & On-Chain Settlement (`GET /v1/orders/{orderId}`)
- **Purpose**: Polls execution progress, fills, and on-chain transaction hashes.
- **Status Mapping**:
  - `open` / `new` / `pending` $\rightarrow$ `PENDING`
  - `submitted` $\rightarrow$ `SUBMITTED`
  - `filled` / `completed` $\rightarrow$ `FILLED`
  - `partially_filled` $\rightarrow$ `PARTIALLY_FILLED`
  - `cancelled` $\rightarrow$ `CANCELLED`
  - `failed` / `expired` $\rightarrow$ `FAILED`
- **On-Chain Evidence**: Fills include `txHash`, surfaced as `transactionHash` with direct block explorer links (`basescan.org`, `etherscan.io`, `arbiscan.io`).

### 3. Non-Custodial Architecture & Assisted Copy Trading
- **User Ownership**: CallLedger never stores private keys, seed phrases, or automated signing permissions.
- **Assisted Review**: Users explicitly review every post-extracted trade draft, configure trade sizing/limits, request a live quote, sign with their connected wallet, and confirm submission.
