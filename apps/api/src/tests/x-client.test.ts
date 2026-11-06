import assert from "node:assert";
import { describe, it } from "node:test";
import { XClient } from "../integrations/x/x-client";
import { XApiError } from "../integrations/x/x-errors";

describe("X API Client Unit Tests", () => {
  it("should look up a user by username successfully", async () => {
    const mockUserResponse = {
      data: {
        id: "1234567890",
        name: "Crypto Analyst",
        username: "cryptoanalyst",
        description: "Macro crypto swings",
      },
    };

    const mockFetch = async () =>
      new Response(JSON.stringify(mockUserResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const client = new XClient({
      bearerToken: "mock_bearer_token",
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const result = await client.getUserByUsername("cryptoanalyst");
    assert.strictEqual(result.user.id, "1234567890");
    assert.strictEqual(result.user.username, "cryptoanalyst");
  });

  it("should handle 404 Not Found as a categorized XApiError", async () => {
    const mockFetch = async () =>
      new Response("Not Found", {
        status: 404,
        headers: { "Content-Type": "text/plain" },
      });

    const client = new XClient({
      bearerToken: "mock_bearer_token",
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    await assert.rejects(
      async () => {
        await client.getUserByUsername("nonexistent_user_99999");
      },
      (err: any) => {
        assert.ok(err.name === "XApiError");
        assert.strictEqual(err.category, "NOT_FOUND");
        assert.strictEqual(err.httpStatus, 404);
        return true;
      },
    );
  });

  it("should detect and extract 429 rate limit reset headers", async () => {
    const futureReset = Math.floor(Date.now() / 1000) + 900;
    const mockFetch = async () =>
      new Response("Too Many Requests", {
        status: 429,
        headers: {
          "x-rate-limit-limit": "900",
          "x-rate-limit-remaining": "0",
          "x-rate-limit-reset": String(futureReset),
        },
      });

    const client = new XClient({
      bearerToken: "mock_bearer_token",
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    await assert.rejects(
      async () => {
        await client.getUserPosts("1234567890");
      },
      (err: any) => {
        assert.ok(err.name === "XApiError");
        assert.strictEqual(err.category, "RATE_LIMITED");
        assert.ok(err.rateLimitResetAt instanceof Date);
        return true;
      },
    );
  });
});
