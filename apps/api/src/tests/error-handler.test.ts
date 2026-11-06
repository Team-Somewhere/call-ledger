import assert from "node:assert";
import { describe, it } from "node:test";
import { z } from "zod";
import { SourceAdapterError } from "@call-ledger/shared";
import { errorHandler } from "../middleware/error-handler";

/**
 * Regression tests for the API error mapping. Domain errors must keep their
 * intended status code (not collapse into 500), and Zod errors must be
 * recognised even when they originate from a different copy of `zod`.
 */

function run(err: unknown) {
  const captured: { status?: number; body?: unknown } = {};
  const res = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: unknown) {
      captured.body = body;
      return this;
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errorHandler(err, {} as any, res as any, (() => {}) as any);
  return captured;
}

describe("API error handler", () => {
  it("maps SourceAdapterError to its own status code and code", () => {
    const out = run(new SourceAdapterError("SSRF_BLOCKED_IP", "blocked", 400));
    assert.strictEqual(out.status, 400);
    assert.deepStrictEqual((out.body as { error: { code: string } }).error.code, "SSRF_BLOCKED_IP");
  });

  it("maps an authorization failure to 403-class codes, not 500", () => {
    const out = run(new SourceAdapterError("AUTHORIZATION_REQUIRED", "confirm", 422));
    assert.strictEqual(out.status, 422);
  });

  it("maps a real ZodError to VALIDATION_ERROR (400)", () => {
    const parsed = z.object({ n: z.number() }).safeParse({ n: "x" });
    assert.ok(!parsed.success);
    const out = run(parsed.error);
    assert.strictEqual(out.status, 400);
    assert.strictEqual((out.body as { error: { code: string } }).error.code, "VALIDATION_ERROR");
  });

  it("still returns 500 for unexpected errors", () => {
    const original = console.error;
    console.error = () => {};
    try {
      const out = run(new Error("boom"));
      assert.strictEqual(out.status, 500);
    } finally {
      console.error = original;
    }
  });
});
