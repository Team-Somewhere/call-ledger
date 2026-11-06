# How CallLedger Uses Arkiv — Workflows

## 1. Ingestion (write path — runs in worker)

```
Monitoring worker cycle
  │
  ├── Claim due creator_sources (FOR UPDATE SKIP LOCKED)
  ├── Check X_MONITOR budget — if exhausted, skip all X sources this cycle
  │
  ├── For each claimed source:
  │     XAdapter.fetchLatestPosts()
  │       └── firecrawl.search("site:x.com/{handle}/status")
  │             └── returns [{url, title, description}]
  │                  └── extract status ID from URL path
  │
  │     NormalizedPost[] inserted into creator_source_posts (ON CONFLICT DO NOTHING)
  │
  │     For each newly-inserted post (X sources only):
  │       1. Check arkiv_records by (sourcePlatform, sourcePostId) — fast local dedup
  │       2. If not found locally: checkPostExists() queries Arkiv directly — cross-instance dedup
  │       3. classifyPost(text) — keyword-based signal classifier
  │       4. walletClient.createEntity(ArchivedXPostSchema, {...}, { expiration })
  │            └── returns { entityKey, txHash }
  │       5. INSERT into arkiv_records (entityKey, txHash, sourcePostId, ...)
  │            └── UNIQUE constraint on (source_platform, source_post_id) prevents races
  │
  │     Update creator_sources (nextFetchAt, release lock)
  │     Insert creator_monitoring_logs (SUCCESS/FAILED/SKIPPED)
```

## 2. Reading (query path — via API)

```
GET /api/archive/posts?username=thornemacro&tradingRelated=true&limit=20

  └── archive.service.ts
       └── createArkivPublicClient({ accessKey, rpcUrl })
            └── publicClient
                  .select({ $key, sourcePostId, postText, capturedAt, ... })
                  .from(ArchivedXPostSchema)
                  .where(and(eq("authorUsername", str("thornemacro")), eq("tradingRelated", bool(true))))
                  .orderBy(desc("capturedAt"))
                  .limit(20)
                  .fetch()
                 ↓
            ArchivedPost[] returned from Arkiv Rabdi

       └── enrichWithLocalData(posts)
            └── SELECT id, txHash, creatorDisplayName FROM arkiv_records
                JOIN creators ON relatedCreatorId
                WHERE sourcePostId IN (...)
                ↓
            Adds localTxHash, creatorId, creatorDisplayName to each post

  └── sendSuccess(res, posts, { hasMore, nextCursor, source: "arkiv" })
```

## 3. Deduplication

Two gates prevent the same post from being archived twice:

**Gate 1 — Local (fast)**:
```sql
SELECT id, entityKey FROM arkiv_records
WHERE source_platform = 'x' AND source_post_id = $1
LIMIT 1;
```
If found → skip write, return `{ skipped: true, reason: "already-in-local-db" }`

**Gate 2 — Arkiv (cross-instance)**:
```typescript
const existingKey = await checkPostExists(publicClient, sourcePostId);
if (existingKey) { /* record locally, skip write */ }
```

Gate 1 is ~100× faster than Gate 2. Gate 2 handles the race condition where two worker instances process the same post simultaneously before either has written to the local DB.

## 4. Expiry tracking

- `expiresAt` is stored in `arkiv_records` at write time.
- `/api/archive/stats` reports `recordsExpiringWithin30Days` from the local table.
- When the API receives a request for an expired entity key, Arkiv returns null and the API responds with 404 and the message "has expired."
- Renewal is not automatic. An admin tool or cron job would need to call `walletClient.patchEntity()` with an extended expiry before entities expire.

## 5. Budget controls

Budget state is in-process memory, reset daily by date string comparison:

```
X_MONITOR_MAX_REQUESTS_PER_DAY=10  (default — very conservative)

Before each X source fetch:
  consumeBudget()
    if (usedRequests >= maxRequests) → recordSkipped(source, "DAILY_BUDGET_EXHAUSTED")
    else → usedRequests++ → proceed with fetch
```

The budget does not persist across worker restarts. On restart, the day's count starts from 0 again. This is intentional for the MVP — a Redis counter or DB-backed counter can replace it for production.

## 6. Environment variables required

| Variable | Required for | Description |
|---|---|---|
| `ARKIV_ACCESS_KEY` | reads + writes | From hub.arkiv.network/access-keys |
| `ARKIV_ARCHIVER_PRIVATE_KEY` | writes only | Hex 0x-prefixed, funded with Rabdi tGLM |
| `ARKIV_RPC_URL` | optional override | Defaults to `https://rpc.rabdi.db-chain.testnet.arkiv.network` |
| `ARKIV_POST_EXPIRY_DAYS` | writes | Default 365 |
| `X_MONITOR_ENABLED` | writes | Set to `true` to enable X monitoring + archiving |
| `FIRECRAWL_API_KEY` + `FIRECRAWL_ENABLED` | writes | Required for Firecrawl X post fetching |

## 7. Testing an actual write + read

```bash
# 1. Set credentials in .env
ARKIV_ACCESS_KEY=your-key
ARKIV_ARCHIVER_PRIVATE_KEY=0x...funded-key

# 2. Start the API
cd apps/api && npm run dev

# 3. Add a trader via the Discover UI or API
curl -X POST http://localhost:8000/api/creators \
  -H "Content-Type: application/json" \
  -H "x-wallet-session: <your-token>" \
  -d '{"sourceType":"X","username":"CryptoTraderXYZ"}'

# 4. Trigger a manual refresh (fetches posts + archives to Arkiv)
curl -X POST http://localhost:8000/api/creators/<id>/refresh \
  -H "x-wallet-session: <your-token>"

# 5. Read from Arkiv
curl "http://localhost:8000/api/archive/traders/CryptoTraderXYZ/posts"

# 6. Check archive stats
curl "http://localhost:8000/api/archive/stats"
```
