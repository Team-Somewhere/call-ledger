# CallLedger Archive — Who Benefits and How

## Primary Audience

### Traders evaluating signal providers

Someone deciding whether to follow a crypto trading account on X wants verifiable historical calls — not a curated highlight reel that a creator could have assembled after the fact.

With CallLedger's Arkiv archive, every call that was live-published is captured and timestamped on-chain. A trader can query the archive directly and see what `@thornemacro` called three months ago, when they called it, and what the price was at that time.

### Researchers and journalists

On-chain archives are independently auditable. A researcher doesn't need to trust CallLedger's reporting or have an account — they can query `callledger.archived_x_post.v1` on Rabdi and reproduce any aggregate or specific claim about a trader's activity.

### Builders and aggregators

The archive is publicly queryable. Any application can integrate with Arkiv's SDK and present CallLedger's archived trading activity in a different interface, without requiring a data-sharing agreement with CallLedger.

### The traders themselves

A creator who consistently posts high-quality calls benefits from immutable proof that they posted those calls before the market moved. They can use their Arkiv entity keys as cryptographic citations in disputes about who called a move first.

## What the Archive Preserves

- Post text (verbatim if available from Firecrawl, labeled PROVIDER_SUMMARY or UNKNOWN otherwise)
- Capture timestamp (on-chain)
- Author handle and display name at capture time
- Trading-signal classification (whether the post contains a buy/sell call)
- Asset tickers mentioned
- Topic tags (swing trade, scalp, futures, etc.)
- Source URL (even if the original tweet is later deleted)

## What the Archive Does Not Do

- Rate creators or produce scores (that happens in CallLedger's application layer)
- Store post analytics like likes or retweet counts (irrelevant to signal quality)
- Archive every tweet by every X user (only traders registered on CallLedger)
- Provide real-time data (monitoring runs on a configurable schedule, default 30 minutes)
