# Arkiv Schema — CallLedger Archived X Posts

## Namespace

```
callledger.archived_x_post.v1
```

Named schemas in Arkiv tag every entity they create with an indexed `arkiv.schema` attribute, so queries through this schema only match CallLedger entities.

---

## Attributes

| Column | SDK Type | Indexed | Description |
|---|---|:---:|---|
| `sourcePlatform` | `str` | ✓ | Always `"x"` — the source social platform |
| `sourcePostId` | `str` | ✓ | Stable X status ID (primary deduplication key) |
| `authorUsername` | `str` | ✓ | Lowercase normalized X handle |
| `authorDisplayName` | `str` | — | Display name at time of capture |
| `postText` | `str` | — | Post content (verbatim or provider summary, up to 4000 chars) |
| `postUrl` | `str` | — | Canonical X status URL |
| `originalCreatedAt` | `u64` | ✓ | Original post creation timestamp in Unix milliseconds; `0` when unknown |
| `capturedAt` | `u64` | ✓ | Timestamp when archived, in Unix milliseconds |
| `contentFidelity` | `str` | ✓ | `VERBATIM` \| `PROVIDER_SUMMARY` \| `UNKNOWN` |
| `captureProvider` | `str` | — | Always `"firecrawl"` |
| `tradingRelated` | `bool` | ✓ | `true` when classified as a trading signal |
| `topics` | `str` | — | JSON string array of topic tags (e.g. `["swing-trade","technical-analysis"]`) |
| `assets` | `str` | — | JSON string array of asset tickers (e.g. `["BTC","ETH"]`) |
| `schemaVersion` | `str` | — | Always `"1"` for this schema version |

---

## Entity System Fields

In addition to the above attributes, every Arkiv entity provides these system fields:

| Field | Type | Description |
|---|---|---|
| `$key` | `0x${string}` | Unique entity key — use as a cursor for pagination |
| `$owner` | address | Address of the wallet that created this entity |
| `$expiresAt` | `u64` | Expiration timestamp in Unix milliseconds |
| `$createdAt` | `u64` | On-chain creation timestamp |

---

## Expiration Policy

- Default expiry: **365 days** from archiving (configurable via `ARKIV_POST_EXPIRY_DAYS`).
- Entities are not automatically renewed. A renewal mechanism is possible but not implemented by default to control costs.
- CallLedger tracks `expiresAt` in the local `arkiv_records` table and surfaces entities expiring within 30 days in the archive stats API.
- When an entity expires on-chain, the archive API will return 404 for that entity key. The frontend handles this gracefully.

---

## Example Query

```typescript
import { createPublicClient, ExpirationTime } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { and, eq, desc } from "@arkiv-network/sdk/query";
import { str, bool } from "@arkiv-network/sdk/schema";
import { ArchivedXPostSchema } from "@call-ledger/arkiv";
import { http } from "viem";

const client = createPublicClient({
  chain: rabdi({ accessKey: process.env.ARKIV_ACCESS_KEY }),
  transport: http(),
});

// Fetch trading signals from a specific trader
const result = await client
  .select({ $key: true, sourcePostId: true, postText: true, capturedAt: true })
  .from(ArchivedXPostSchema)
  .where(
    and(
      eq("authorUsername", str("thornemacro")),
      eq("tradingRelated", bool(true)),
    ),
  )
  .orderBy(desc("capturedAt"))
  .limit(20)
  .fetch();

for (const entity of result.entities) {
  console.log(entity.$key, entity.postText?.value);
}
```

---

## Local Reference Table (PostgreSQL)

The `arkiv_records` table in PostgreSQL stores lightweight references to Arkiv entities:

- `entityKey` — the Arkiv entity key
- `txHash` — Rabdi transaction hash from the write
- `sourcePlatform` + `sourcePostId` — deduplication keys (unique constraint)
- `expiresAt` — expiry for local tracking
- `tradingRelated` — classification result
- `relatedCreatorId` — FK to `creators` table

Post **content is not stored in PostgreSQL**. The `arkiv_records` table is a reference index, not a content cache.
