# @call-ledger/arkiv

Architectural foundation and interface definitions for Arkiv decentralized attestation and verifiable data persistence.

## Overview

CallLedger uses Arkiv to anchor verifiable creator identity, trading call timestamps, signal attestations, and performance checkpoints on-chain. This ensures that trading history cannot be retrospectively altered or deleted.

## Scope in Phase 1

- Type declarations and entity payload schemas.
- Client interface contracts (`IArkivClient`).
- Configuration schema.
- Architectural guidelines.

_Note: Live Arkiv blockchain transactions and contract signing are scheduled for Phase 6._

## Architectural Principles

1. **Reference-Based Storage**: The CallLedger database stores entity references (`arkiv_records` table) rather than large replicated JSON payloads.
2. **No Raw Social Content**: Never store raw tweet text or copyrighted media in immutable Arkiv records. Only store cryptographic hashes, timestamps, and normalized structured parameters.
3. **Ownership & Rotation**: Ensure creator attestation records are owned by platform authority keys with verifiable signatures, enabling key rotation without invalidating historical proofs.
4. **Expiration Considerations**: Ephemeral signals or expired market updates should carry explicit TTL/expiration metadata if supported by the underlying Arkiv network.
