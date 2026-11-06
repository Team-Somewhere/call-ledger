# Phase 2B: Global source monitoring

Phase 2B polls each global `creator_sources` row once per scheduled cycle. Posts
are stored once in `creator_source_posts`; a personal activity query joins those
rows to the signed-in user's active `user_creator_follows`. Followers never
create separate polling jobs or post copies.

## Worker and scheduling

Run the worker as its own process:

```bash
npm run dev --workspace=@call-ledger/worker
```

The worker claims due `ACTIVE` sources in a short PostgreSQL transaction using
`SELECT ... FOR UPDATE SKIP LOCKED`, then sets `locked_by` and a lease expiration.
The lease makes a crashed worker's source claim recoverable. The provider fetch
happens outside the transaction; successful post upserts, source state updates,
and monitoring logs are written transactionally. A unique constraint on
`(creator_source_id, external_post_id)` makes post ingestion idempotent.

Defaults are RSS every 15 minutes, Bluesky every 10 minutes, and websites every
60 minutes. A random jitter is added to each next-fetch time. Network/provider
failures use exponential backoff; a `Retry-After` header takes precedence. After
the configured retry burst, the worker waits at least eight source intervals
before retrying. Non-retryable configuration errors set the source to `ERROR`
until an administrator corrects it. Each attempt is recorded in
`creator_monitoring_logs`.

The first successful poll is bounded by `MONITORING_INITIAL_POST_LIMIT`
(default 20). RSS sends ETag and Last-Modified validators and treats HTTP 304 as
a successful zero-post run. Bluesky reads the newest author-feed page by stable
DID and deduplicates AT URIs; its cursor is retained for diagnostics, but the
worker does not resume a cursor toward older history on the next cycle.

## Providers

- **RSS/Atom:** supports conditional GET, response size/time limits, manual
  redirect validation, and RSS/Atom parsing. Feed URLs are retained in private
  source metadata and are not returned by the API.
- **Bluesky:** uses the public `app.bsky.feed.getAuthorFeed` API and does not
  require credentials. Replies and reposts are normalized and can be filtered
  in the feed.
- **Authorized websites:** requires explicit source authorization and
  `FIRECRAWL_ENABLED=true` plus `FIRECRAWL_API_KEY`. The current adapter refreshes
  only the explicitly registered page; it does not crawl a domain or discover
  RSS/sitemap URLs. Firecrawl configuration failures skip website monitoring
  without affecting RSS or Bluesky.
- **X:** remains disabled by default. There is no scraping, browser automation,
  undocumented endpoint, or cookie access. X sources wait for an authorized
  provider and no fake posts are generated.

## API and activity feed

- `GET /api/me/activity` requires a wallet session and returns only posts from
  creators followed by that user. It supports cursor, creator, source, date,
  reply, and repost filters.
- `GET /api/creators/:creatorId/posts` returns the creator's recent normalized
  source posts.
- `GET /api/creator-sources/:sourceId/status` returns public monitoring state.
- `GET /api/monitoring/overview` and `/api/monitoring/logs` require an admin
  wallet session.

The frontend feed reads PostgreSQL-backed API results; it does not invoke
provider integrations. Provider credentials and raw payloads are not included
in feed, source-status, or monitoring responses. Sensitive URL query parameters
are redacted from public source links.

## Configuration

Copy `.env.example` to `.env`. Required for monitoring is `DATABASE_URL`.
Defaults are provided for worker enablement, source intervals, initial and
regular post limits, retry count, lease duration, batch size, jitter, timeout,
and response-size limits. Set Firecrawl values only for authorized website
monitoring. RSS and Bluesky require no API keys.

Important settings:

```env
MONITORING_WORKER_ENABLED=true
MONITORING_POLL_INTERVAL_RSS_SECONDS=900
MONITORING_POLL_INTERVAL_BLUESKY_SECONDS=600
MONITORING_POLL_INTERVAL_WEBSITE_SECONDS=3600
MONITORING_INITIAL_POST_LIMIT=20
MONITORING_MAX_RETRIES=3
FIRECRAWL_ENABLED=false
X_INGESTION_ENABLED=false
```

## Development and verification

```bash
npm install
npm run db:migrate
npm run dev --workspace=@call-ledger/web
npm run dev --workspace=@call-ledger/api
npm run dev --workspace=@call-ledger/worker
npm run test --workspace=@call-ledger/api
npm run typecheck
npm run build
```

The worker requires a reachable PostgreSQL database. Provider API tests use
mocked responses; they do not make live provider requests.
