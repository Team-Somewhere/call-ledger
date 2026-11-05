# @call-ledger/strategy-engine

Architectural foundation and interface definitions for CallLedger's copy-trading strategy evaluation engine.

## Overview

The Strategy Engine analyzes incoming trading signals against individual user copy-trading rules, creator performance metrics, and risk management constraints before triggering order generation.

## Scope in Phase 1

- Context schema for strategy evaluation (`StrategyEvaluationContext`).
- Rejection reasons and result typings (`StrategyEvaluationResult`).
- Baseline constraints validator.
- Engine interface contract (`IStrategyEngine`).

_Note: Automated multi-strategy evaluation loops, queue processing, and dynamic position sizing are scheduled for Phase 4._

## Evaluation Pipeline

1. **Eligibility Check**: Is the strategy ACTIVE? Does the followed creator match?
2. **Frequency Caps**: Has the user hit `maxDailyTrades` for this strategy?
3. **Direction Filter**: Does the signal match `allowedDirections` (BUY / SELL / BOTH)?
4. **Reputation Floor**: Does the creator's verified win rate satisfy `minCreatorWinRate`?
5. **Sizing & Risk Parameters**: Assign `maxTradeAmount`, SL %, and TP % boundaries.
