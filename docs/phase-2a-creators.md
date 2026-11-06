# Phase 2A — Creator Management, Wallet Following & Source Integration

This document describes what Phase 2A delivers, how the pieces fit together, and how to run and verify them.

Phase 2A covers: global creator identity, multi-source creator records, wallet-authenticated following, and source validation for RSS, Bluesky, authorized websites (Firecrawl) and X (placeholder).

It does **not** cover the background worker, post ingestion, AI signal extraction, performance metrics, Arkiv, Definitive Flash, or copy-trading. Those are Phase 2B and later.

---

## 1. Architecture

### 1.1 Global creators and source identities

A **creator** is one real-world trader. A creator owns one or more **source identities** (`creator_sources`):

```
creators (1) ──< creator_sources (N)       X profile, Bluesky profile, RSS feed, website
     │
     └──< user_creator_follows (N) >── users     many users follow one creator
     │
     └──< creator_identity_links (per source)    how each source was attached
```

- One creator can have many sources (for example an X account, a Bluesky account and an RSS feed).
- The same creator can be followed by many users. All of them reference one `creators` row, so no duplicate creators are created.
- Two profiles are **never merged automatically** because their handles look similar. A second source is attached only by an explicit link (`POST /api/creator-sources`), and the link is recorded in `creator_identity_links` with its relationship type and verification method.
- Every source starts `UNVERIFIED`. Verification requires an explicit proof (`SELF_VERIFIED` / `ADMIN_VERIFIED`), which Phase 2A does not automate.

### 1.2 Source status

| Status | Meaning |
| --- | --- |
| `ACTIVE` | The platform may fetch this source (Phase 2B). |
| `WAITING_FOR_AUTHORIZED_ACCESS` | Saved, but live monitoring is not enabled. Used for X. |
| `DISABLED` | Monitoring paused by a user or admin. |
| `ERROR` | The last monitoring attempt failed (`last_error`). |

### 1.3 Schema (Phase 2B-ready)

`creator_sources` already contains the monitoring state that Phase 2B will use: `last_fetched_at`, `next_fetch_at`, `last_cursor`, `last_error`, `last_error_at`, `retry_count`, `etag`, `last_modified`, and `provider_meta`. Phase 2A writes these fields as empty but does not run the worker.

Unique constraints:
- `creator_sources`: one identity per `(creator_id, source_type, coalesce(external_id, handle, canonical_url))`.
- `user_creator_follows`: one row per `(user_id, creator_id)`.
- `creator_identity_links`: one link per `creator_source_id`.

### 1.4 Provider-independent adapter layer

All providers live in `apps/api/src/integrations/sources/`, one module each. They implement a shared interface from `@call-ledger/shared` (`CreatorSourceAdapter`):

| Module | Provider | Phase 2A behavior |
| --- | --- | --- |
| `rss.adapter.ts` | RSS 2.0 / Atom | Validates and resolves feeds (SSRF-safe fetch, size and timeout limits). |
| `bluesky.adapter.ts` | Bluesky public API | Resolves a handle to a DID via `getProfile`. No credentials. |
| `website.adapter.ts` + `firecrawl/` | Authorized websites | Validates URL and authorization confirmation. Crawling is Phase 2B. |
| `x.adapter.ts` | X | Placeholder. Returns `WAITING_FOR_AUTHORIZED_ACCESS`. Makes no network requests. |

The database and frontend depend only on the normalized `ValidatedCreatorSource` shape, never on provider payloads. A future authorized X provider replaces `x.adapter.ts` and needs no schema change.

### 1.5 Wallet authentication

Wallet authentication is separate from X access. Connecting or signing with a wallet proves control of an EVM address. It grants **no** access to X.

Flow (`apps/api/src/services/wallet-auth.service.ts`):

1. `POST /api/auth/wallet/nonce` with `{ address }` returns a random nonce, the EIP-4361-style message to sign, and an expiry.
2. The wallet signs the message with `personal_sign`. The app never asks for a private key or seed phrase.
3. `POST /api/auth/wallet/verify` with `{ address, nonce, signature }`:
   - the nonce must exist, belong to this address, be unused, not superseded and not expired;
   - the server rebuilds the exact message and recovers the signer with viem (EIP-191);
   - the nonce is consumed with a conditional `UPDATE ... WHERE used_at IS NULL`, so it is single-use even under concurrent requests;
   - the user is created or looked up by the lowercase address and a signed session token is issued.

Addresses are normalized to lowercase everywhere. Session tokens are HMAC-signed with a server-side secret (`SESSION_SECRET`).

**Bug fixed in this phase:** the signed message used the JavaScript clock for `issuedAt`, while verification rebuilt it from the database `created_at` (a `defaultNow()` value). The two timestamps could differ, so valid signatures were rejected with `INVALID_SIGNATURE`. The nonce row now stores the same timestamp that is signed. Regression tests are in `wallet-nonce-timestamp.test.ts`.

### 1.6 How following works

- Following is an **off-chain database operation**. It creates a `user_creator_follows` row. It does **not** create a blockchain transaction, and it does **not** follow the creator on X or Bluesky.
- Following is idempotent. Following twice returns the existing follow with `created: false`.
- Unfollowing sets `is_active = false`, so preferences and history are kept. Re-following reactivates the row.
- Only the authenticated user's own follows are read or changed.

### 1.7 Error handling

Domain errors are `SourceAdapterError` instances with a stable `code`, a safe message and an HTTP status. The error handler (`apps/api/src/middleware/error-handler.ts`) returns them as-is. Zod validation errors return `400 VALIDATION_ERROR`. Unexpected errors return `500` with no internal detail in production.

Zod errors and domain errors are detected by shape, not `instanceof`. The workspace has more than one copy of `zod` installed, so `instanceof ZodError` silently fails across packages. Before this fix, every validation and SSRF error was returned as a 500.

---

## 2. Provider details

### 2.1 RSS

- Accepts only `http:` and `https:` URLs.
- Blocks localhost, private, link-local and metadata IP ranges (`ssrf.ts`), both for the initial URL and for every redirect hop.
- Enforces a request timeout and a maximum response size, and checks the content type.
- Parses RSS 2.0 and Atom with `rss-parser`. Items without a GUID get a stable fallback ID.
- Malformed XML and unavailable feeds are reported as provider errors, not crashes.
- Feed title is used as a suggested creator display name.

### 2.2 Bluesky

- Uses the public AppView at `https://public.api.bsky.app` (`app.bsky.actor.getProfile`). **No API key and no app password** are needed or requested.
- Validates handle format before making any request.
- Stores the DID as `external_id` (the stable identity) and the profile URL as `canonical_url`.
- Maps a missing profile, invalid handle, API failure and rate limiting (HTTP 429) to distinct errors.
- Phase 2B can reuse the same adapter for author-feed reads.

### 2.3 Firecrawl (authorized websites only)

- Runs only when **both** `FIRECRAWL_ENABLED=true` and `FIRECRAWL_API_KEY` are set. Otherwise the adapter refuses with a clear error. The rest of the app works without it.
- Requires the user to confirm they are authorized to crawl the site. Without that confirmation, registration fails with `AUTHORIZATION_REQUIRED`.
- Refuses X and other social-network targets. Phase 2A never uses Firecrawl to scrape X.
- Does not crawl whole domains automatically. `FIRECRAWL_MAX_PAGES_PER_RUN` caps the pages per run (used in Phase 2B).
- The API key stays on the server and is never returned in responses or logged.

### 2.4 X

- `X_INGESTION_ENABLED=false` by default.
- A username can be saved. The creator is marked `WAITING_FOR_AUTHORIZED_ACCESS` with the notice: *"X monitoring is not currently available. This creator has been saved to your CallLedger following list and can be monitored when an authorized source is configured."*
- The adapter makes **no** network requests and creates **no** posts.
- Not implemented, by policy: undocumented X GraphQL, browser automation of X, session cookie or `auth_token`/`ct0` extraction, and any unauthorized scraping.
- Following an X creator on CallLedger does **not** follow the account on X.

---

## 3. API endpoints

All responses use `{ success, data, meta?, error? }`. Authenticated routes need a wallet session (`Authorization: Bearer <token>` or `x-wallet-session` header).

### Wallet auth

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/wallet/nonce` | none | Issue a single-use login nonce. |
| POST | `/api/auth/wallet/verify` | none | Verify the signature and receive a session token. |
| GET | `/api/auth/me` | wallet | Current session. |

### Creators

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/creators/resolve` | none | Validate a source without saving. Reports `alreadyExists`. |
| POST | `/api/creators` | wallet | Create a creator with its first source, or reuse the existing one (200 vs 201). |
| GET | `/api/creators` | none | Paginated global directory. Filter with `sourceType` or `search`. |
| GET | `/api/creators/:id` | none | Creator detail with sources and follower count. Includes `isFollowing` when signed in. |
| POST | `/api/creators/:id/follow` | wallet | Follow (idempotent). |
| DELETE | `/api/creators/:id/follow` | wallet | Unfollow (idempotent). |
| GET | `/api/me/following` | wallet | The user's followed creators. Paginated, filter by `sourceType`. |

### Sources

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/creator-sources` | wallet | Explicitly link a source to an existing `creatorId`. |
| GET | `/api/creator-sources/:id` | none | Source status and identity link. |
| DELETE | `/api/creator-sources/:id` | wallet | Remove a source. Admins may remove any source. Other users may remove only sources they added. A creator with no sources left is removed. |

### Monitoring

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/monitoring/sources/overview` | none | Adapter configuration and source counts. Returns no secrets. |

Ownership is enforced on the server. Creator IDs and source IDs are validated as UUIDs, and the user is taken from the verified session, never from the request body.

---

## 4. Frontend

| Route | What it shows |
| --- | --- |
| `/discover` | Source selector (X, Bluesky, RSS, Website). Resolves the source and shows real metadata or a notice. Adds the creator and follows it. The X flow states that live monitoring is awaiting authorized access. |
| `/following` | Followed creators with avatars, source badges, source URLs, status, follow date and unfollow. Filter by source type. Asks for wallet sign-in when signed out. |
| `/creators` | Global creator directory. |
| `/creators/[id]` | Creator profile with source profiles, verification status, follow/unfollow, monitoring status, and an empty post state. No fabricated posts or performance. |

Pages call the API through `apps/web/lib/api.ts`. The wallet session is kept in `localStorage` under a key of its own and is never used as X access.

The Phase 1 pages (home, activity, portfolio, signals, strategies) still use mock data. That is outside this phase and is not changed.

---

## 5. Environment variables

Copy `.env.example` to `.env` at the repository root. The API and worker load the root `.env` (`dotenv.config({ path: ../../.env })`), so they do not need their own file. Do **not** copy `.env` into a workspace folder.

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | — | PostgreSQL / Neon connection string. Server-side only. |
| `SESSION_SECRET` | recommended | falls back to other secrets | HMAC key for session tokens. Use `openssl rand -base64 48`. |
| `WALLET_NONCE_TTL_MS` | no | `300000` | Nonce lifetime. |
| `ADMIN_WALLET_ADDRESSES` | no | empty | Comma-separated lowercase admin addresses. |
| `FIRECRAWL_ENABLED` | no | `false` | Must be `true` together with a key. |
| `FIRECRAWL_API_KEY` | only for websites | — | Server-side only. Never prefix with `NEXT_PUBLIC_`. |
| `FIRECRAWL_MAX_PAGES_PER_RUN` | no | `5` | Page cap per run (Phase 2B). |
| `FIRECRAWL_BASE_URL` | no | `https://api.firecrawl.dev` | Optional override. |
| `X_INGESTION_ENABLED` | no | `false` | Keep `false` unless an authorized X provider is configured. |
| `NEXT_PUBLIC_API_URL` | yes (web) | `http://localhost:8000` | The only `NEXT_PUBLIC_` value the app uses. It contains no secret. |

RSS and Bluesky need **no** API keys. Secrets are read only in server code (`apps/api/src/config/env.ts`).

The adapter refusal without a key is covered by the unit tests in `source-adapters.test.ts` ("refuses to run without an API key"). The local `.env` currently has a key set, so the overview reports `firecrawlConfigured: true`.

---

## 6. Database migrations

Phase 2A adds migration `0002_smiling_betty_brant`, which creates `creator_sources`, `creator_identity_links`, `user_creator_follows` and `wallet_nonces`. Migrations `0000` and `0001` are the Phase 1 and Phase 2 schema.

```bash
# Apply pending migrations (uses DATABASE_URL from the root .env)
npm run db:migrate

# Check that the TypeScript schema matches the migrations (prints "No schema changes")
npm run db:generate --workspace=@call-ledger/database

# Browse the database (optional)
npm run db:studio
```

Do not edit migration SQL by hand. Change `packages/database/src/schema/*.ts`, then run `db:generate`.

---

## 7. Running the stack

```bash
# Install (npm workspaces; do not use Bun)
npm install

# Backend API (http://localhost:8000)
npm run dev --workspace=@call-ledger/api

# Frontend (http://localhost:3000)
npm run dev --workspace=@call-ledger/web

# Background worker (Phase 2B logic; heartbeat and polling placeholder)
npm run dev --workspace=@call-ledger/worker

# Everything through Turborepo
npm run dev
```

---

## 8. Testing

```bash
# All API tests (unit + DB-backed; DB tests run when DATABASE_URL is set)
npm run test --workspace=@call-ledger/api

# Unit tests only (no database or network)
npm run test:unit --workspace=@call-ledger/api

# Wallet nonce flow against the real database
node --import tsx --import ./src/tests/setup-env.ts --test src/tests/wallet-nonce-flow.test.ts
```

Run these from `apps/api`, or use the workspace flag as shown.

Test files:

| File | Covers |
| --- | --- |
| `wallet-auth.test.ts` | Session tokens, tamper and expiry checks, signature recovery and rejection. |
| `wallet-nonce-flow.test.ts` (DB) | Single-use nonce, expired nonce, invalid signature without burning the nonce, superseded nonce. |
| `wallet-nonce-timestamp.test.ts` | Regression: the signed message must be reproducible from the stored timestamp. |
| `creator-follow.test.ts` (DB) | Add X/Bluesky creator, duplicate identity, explicit link, refusing to steal a source, follow, duplicate follow, unfollow, multiple followers, not-found. |
| `source-adapters.test.ts` | RSS (RSS 2.0, Atom, missing GUID, malformed XML, invalid URL, SSRF), Bluesky (resolution, DID, missing profile, invalid handle, API failure, rate limit), Firecrawl (no key, disabled, invalid URL, no authorization, provider failure), X placeholder (no fake posts, no requests). |
| `error-handler.test.ts` | Domain and Zod errors keep their status codes; unexpected errors still return 500. |

External providers are **mocked** in automated tests. No test calls a live provider. The DB-backed tests create and delete their own rows.

Manual end-to-end check used during this phase (against the running API and Neon): wallet sign-in, X creator add (`WAITING_FOR_AUTHORIZED_ACCESS`), follow, duplicate follow (200, not duplicated), two users following one creator (`followersCount: 2`), unfollow, cross-user source deletion (403), Bluesky resolution to a DID, SSRF rejection of a metadata address.

---

## 9. Limitations (Phase 2A)

- **No live X monitoring.** Requires an authorized X provider. The X adapter is a placeholder by design.
- **No worker.** `next_fetch_at`, `last_cursor` and retry fields are stored but never set by a job. Phase 2B adds scheduling.
- **Website crawling is not run.** Only authorization and URL validation are implemented. Firecrawl crawling is Phase 2B.
- **Identity verification is manual.** Sources stay `UNVERIFIED` until an explicit proof or admin action. There is no automatic verification flow.
- **Identity linking has no review UI.** Linking is available through the API (`POST /api/creator-sources`) and is not yet exposed in the frontend.
- **Wallet session tokens are stateless.** They are valid until expiry (7 days) and cannot be revoked server-side. Add a session table if revocation is needed.
- **Phase 1 pages still use mock data** (home, activity, portfolio, signals, strategies). They are outside Phase 2A.
- **Frontend wallet sign-in** requires a browser wallet. The frontend connection flow was checked for compilation and page rendering, not in a real browser with a wallet extension.
