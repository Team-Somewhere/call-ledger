# Why Arkiv — CallLedger's Case for On-Chain Archiving

## The Problem

Crypto traders publish calls on X. CallLedger monitors those calls and measures performance — who called BTC at $88k and hit their target, who blew their stop. But there's a fundamental integrity problem: tweets can be deleted.

A trader who deletes their losers and screenshots their winners becomes impossible to evaluate fairly if the platform uses live X data. Any score can be gamed.

## Why Not Just Store Posts in PostgreSQL?

We do store post metadata in PostgreSQL — but post content in a mutable, operator-controlled database doesn't solve the integrity problem. CallLedger's operator can modify or delete records too. Users need an independently queryable, tamper-evident record they can verify without trusting CallLedger.

## Why Arkiv

Arkiv is a queryable, time-scoped on-chain data store built on top of Ethereum. It's not a simple event log — entities are structured, indexed, and queryable via a typed SDK. That's the key: the same tools that write entities can query them without going through CallLedger's API.

### What Arkiv gives CallLedger:

1. **Operator-independent verification**: Any third party can query `callledger.archived_x_post.v1` directly on Rabdi and read the archived posts without asking CallLedger for anything.

2. **Deletion resistance**: Once a post is written to Arkiv, deleting the original tweet doesn't affect the archived entity. The post content remains readable from Arkiv until the entity expires.

3. **Time-scoped integrity**: The `capturedAt` timestamp is on-chain. An entity can't be backdated. If a trader claims they called a move before anyone else, the Arkiv entity key and block timestamp tell the truth.

4. **Typed queryable store**: Arkiv isn't Arweave or IPFS — you can query `WHERE authorUsername = 'thornemacro' AND tradingRelated = true ORDER BY capturedAt DESC`. This makes the archive useful, not just stored.

5. **Cost-controlled**: Arkiv entities have explicit expiration. CallLedger uses 365-day defaults, which is appropriate for the trading signal use case (older signals lose relevance). This keeps storage costs bounded.

## What Arkiv Cannot Do

- **Prove the post is authentic**: The entity proves that CallLedger's monitoring worker captured this text from Firecrawl at this timestamp with this content. It does not prove the original tweet was written by the claimed author — that would require X's own signing infrastructure.
- **Prevent all tampering**: The entity owner (CallLedger's archive wallet) could technically delete an entity. `readonly: true` prevents attribute modification but not deletion. This limitation is documented and accepted for a testnet integration.
- **Store unlimited content**: Arkiv str attributes have a 128 KiB limit. Long-form post threads are truncated at 4000 characters.
- **Guarantee permanent storage**: Entities expire. Renewal must be triggered explicitly. An unrenewed entity after 365 days is gone.

## Summary

Arkiv is appropriate here because it provides independently queryable, time-scoped, structured storage that goes beyond "append-only log." Users can verify that CallLedger didn't fabricate or modify a trading call by querying Arkiv directly — without any API key or CallLedger account.
