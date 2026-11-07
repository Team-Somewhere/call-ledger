import { describe, it } from "node:test";
import assert from "node:assert/strict";

const apiKey =
  process.env.DEFINITIVE_FLASH_API_KEY || process.env.DEFINITIVE_API_KEY;

describe("Flash API connectivity", () => {
  it("authenticates with the configured key without placing an order", async () => {
    if (!apiKey) {
      console.log("skipped: DEFINITIVE_FLASH_API_KEY is not set");
      return;
    }
    const response = await fetch(
      "https://flash.definitive.fi/v1/search?query=weth&chain=base",
      {
        headers: { "x-definitive-api-key": apiKey },
      },
    );
    assert.equal(response.status, 200);
    const body = (await response.json()) as { results?: unknown };
    assert.ok(body && typeof body === "object");
  });
});
