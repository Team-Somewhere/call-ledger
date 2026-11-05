# @call-ledger/definitive

Architectural foundation and interface definitions for Definitive Flash trading integration.

## Overview

CallLedger integrates with Definitive Flash for advanced decentralized trade execution, optimal routing, non-custodial limit and market orders, and automated copy-trading fills.

## Scope in Phase 1

- Flash client configuration interfaces.
- Quote request and response types.
- EIP-712 / message signing data schemas.
- Non-custodial submission models.
- Order tracking contracts (`IDefinitiveClient`).

_Note: Live quote requests, trade executions, and API key authentications are scheduled for Phase 5._

## Security & Non-Custodial Architecture

1. **No Custody**: CallLedger never retains private keys, mnemonic phrases, or withdrawal permissions.
2. **User Signature Model**: Orders are prepared server-side, signed directly on the client side by the user's wallet (via the web dashboard or browser extension), and broadcast via Definitive Flash.
3. **Deterministic Verification**: Quotes and slippage boundaries are strictly validated against user strategy parameters before submission.
