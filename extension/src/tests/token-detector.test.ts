import { describe, expect, it } from "vitest";
import { detectTokenMentions, uniqueSymbols } from "../content/token-detector";

describe("token detection in post text", () => {
  it("detects plain capitalised symbols from the allowlist", () => {
    expect(uniqueSymbols(detectTokenMentions("ETH is moving today"))).toEqual(["ETH"]);
  });

  it("detects cashtags for any symbol", () => {
    const m = detectTokenMentions("long $PEPE here");
    expect(m[0]).toMatchObject({ symbol: "PEPE", kind: "cashtag" });
  });

  it("detects hashtags only for known symbols", () => {
    expect(uniqueSymbols(detectTokenMentions("#SOL to the moon"))).toEqual(["SOL"]);
    expect(detectTokenMentions("#Base is great")).toEqual([]);
  });

  it("does not treat ordinary words as tokens", () => {
    expect(detectTokenMentions("so all of us are big fans")).toEqual([]);
  });

  it("does not treat lowercase bare words as tokens", () => {
    expect(detectTokenMentions("eth could be interesting")).toEqual([]);
  });

  it("ignores token names inside URLs and @mentions", () => {
    expect(detectTokenMentions("see https://example.com/ETH and @ETH")).toEqual([]);
  });

  it("de-duplicates repeated symbols", () => {
    expect(uniqueSymbols(detectTokenMentions("$ETH $ETH ETH"))).toEqual(["ETH"]);
  });

  it("detects USDC and SOL cashtags", () => {
    expect(uniqueSymbols(detectTokenMentions("$USDC and $SOL"))).toEqual(["USDC", "SOL"]);
  });
});
