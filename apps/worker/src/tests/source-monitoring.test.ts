import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeRetryDelayMs } from "../jobs/source-monitoring.job";

describe("source monitoring retry schedule", () => {
  it("uses exponential backoff and applies jitter before retries are exhausted", () => {
    assert.equal(
      computeRetryDelayMs({
        failureCount: 2,
        intervalSeconds: 600,
        maxRetries: 3,
        retryAfterMs: 0,
        jitterSeconds: 15,
      }),
      1_215_000,
    );
  });

  it("respects Retry-After when it is longer than exponential backoff", () => {
    assert.equal(
      computeRetryDelayMs({
        failureCount: 1,
        intervalSeconds: 900,
        maxRetries: 3,
        retryAfterMs: 3_600_000,
        jitterSeconds: 30,
      }),
      3_600_000,
    );
  });

  it("waits at least eight source intervals after the retry burst is exhausted", () => {
    assert.equal(
      computeRetryDelayMs({
        failureCount: 3,
        intervalSeconds: 900,
        maxRetries: 3,
        retryAfterMs: 0,
        jitterSeconds: 60,
      }),
      7_260_000,
    );
  });

  it("caps exponential backoff while preserving a longer Retry-After", () => {
    assert.equal(
      computeRetryDelayMs({
        failureCount: 10,
        intervalSeconds: 3600,
        maxRetries: 20,
        retryAfterMs: 0,
        jitterSeconds: 0,
      }),
      21_600_000,
    );
  });
});
