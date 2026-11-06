# Arkiv SDK — Integration Friction Notes

Real issues encountered integrating `@arkiv-network/sdk` v1.x into the CallLedger TypeScript monorepo.

---

## 1. TypeScript strict types on schema values

**Problem**: The SDK schema column types (`str`, `u64`, `bool`) are generic tagged-union types. Passing raw TypeScript primitives (`bigint`, `string`, `boolean`) directly to `createEntity()` causes TS2322 compile errors.

**Resolution**: Always wrap values with the SDK constructors when calling `createEntity()`:
```typescript
// Wrong:
capturedAt: BigInt(Date.now()),

// Correct:
capturedAt: u64(BigInt(Date.now())),
```

---

## 2. Entity key type — `0x${string}`

**Problem**: `getEntity(key, Schema)` expects the key typed as `` `0x${string}` ``, but entity keys from query results come back as `unknown`. A plain `string` variable causes TS2345.

**Resolution**: Cast with `as \`0x${string}\`` or use `entityKey as \`0x${string}\``.

---

## 3. Where-clause combined predicates

**Problem**: `and(...)` has strict overloads that check each argument against the schema's indexed columns at compile time. Dynamic arrays of predicates cause type mismatch errors.

**Resolution**: We implemented branched where-clause construction — one branch per filter combination — rather than building a dynamic predicate array. Verbose but type-safe.

---

## 4. No cursor-based pagination via `afterKey`

**Problem**: The SDK supports `.offset(n)` but this causes missed/duplicated rows if rows are written between pages. The suggested alternative is key-based pagination using `gt("$key", lastKey)`.

**Limitation**: `gt("$key", ...)` requires the key value as an SDK `key(...)` value, not a plain string. At the time of implementation, the `key()` type is not exported in a way that integrates cleanly with the where-clause typed generics when the schema doesn't have a `$key` column explicitly.

**Current workaround**: The archive feed uses offset pagination for the MVP. Key-based pagination can be added when the SDK makes the `key()` predicate type easier to compose.

---

## 5. Wallet requires testnet funding

**Problem**: `createEntity()` submits an on-chain transaction. An unfunded wallet throws a gas estimation error with no clear user-facing message.

**Resolution**: The archiver service logs a clear warning when `ARKIV_ARCHIVER_PRIVATE_KEY` is missing. Fund the archiver wallet address at `hub.arkiv.network/faucet` before enabling writes.

---

## 6. Rabdi RPC rate limiting

**Problem**: The Rabdi public RPC endpoint is rate-limited. Heavy test loops or parallel writes can hit the limit.

**Resolution**: Use `ARKIV_ACCESS_KEY` (from hub.arkiv.network/access-keys) to get a higher rate limit tier. The key is included in the `rabdi({ accessKey })` chain config and passed in every RPC request header automatically.

---

## 7. Schema name uniqueness is application-level

**Problem**: Arkiv does not enforce that only one application writes entities with a given schema name. Any wallet can write entities tagged `callledger.archived_x_post.v1`.

**Resolution**: CallLedger uses `sourcePlatform + sourcePostId` as its logical deduplication key and checks Arkiv before writing. The `$owner` system field identifies which wallet wrote each entity; queries can optionally filter by owner address.

---

## 8. `ExpirationTime.fromDays()` returns an opaque type

**Problem**: `ExpirationTime` is a class with a private constructor. It cannot be stored or serialized — only passed to `createEntity()`.

**Resolution**: Calculate the wall-clock `expiresAt` separately in JavaScript (`Date.now() + days * 86400000`) and store that in the local `arkiv_records` table. The `ExpirationTime` object is passed directly to `createEntity()` and discarded.

---

## 9. No built-in application-level uniqueness

**Problem**: Arkiv does not enforce that `(sourcePlatform, sourcePostId)` is unique. Two workers could race to write the same post.

**Resolution**: 
1. Local DB unique constraint on `(source_platform, source_post_id)` in `arkiv_records` — first writer wins, second gets a conflict and skips.
2. `FOR UPDATE SKIP LOCKED` in the worker's claim query ensures at most one worker processes a given creator source at a time.
3. Before writing, `checkPostExists()` queries Arkiv directly to catch cross-instance races.

---

## 10. Firecrawl returns `new Date()` as publishedAt

**Problem**: The X adapter's `fetchLatestPosts()` via Firecrawl search (`site:x.com/{handle}/status`) cannot reliably extract the original post timestamp from search result snippets. It uses `new Date()` as `publishedAt`.

**Resolution**: `originalCreatedAt` is stored as `0` (u64) when the real timestamp is unknown. The archive UI shows the `capturedAt` timestamp and labels it as "ARCHIVED" rather than "PUBLISHED". `contentFidelity` is set to `UNKNOWN` because Firecrawl search descriptions may be summaries, not verbatim post text.
