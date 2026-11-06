import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DefinitiveClient, mapFlashStatusToOrderStatus } from "./client";
import { DefinitiveApiError } from "./errors";

describe("Definitive Flash Client", () => {
  it("reports unconfigured when apiKey is missing", () => {
    const client = new DefinitiveClient({});
    assert.equal(client.isConfigured(), false);
  });

  it("throws DEFINITIVE_NOT_CONFIGURED error without making network calls when unconfigured", async () => {
    let fetchCalled = false;
    const client = new DefinitiveClient({
      fetch: (async () => {
        fetchCalled = true;
        return new Response();
      }) as any,
    });

    await assert.rejects(
      async () => {
        await client.getQuote({
          targetChain: "base",
          contraChain: "base",
          targetAsset: "0x4200000000000000000000000000000000000006",
          contraAsset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          side: "buy",
          qty: "100",
          funderAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof DefinitiveApiError);
        const apiErr = err as DefinitiveApiError;
        assert.equal(apiErr.code, "DEFINITIVE_NOT_CONFIGURED");
        assert.equal(apiErr.statusCode, 503);
        return true;
      },
    );

    assert.equal(fetchCalled, false);
  });

  it("sends authenticated request with x-definitive-api-key to /v1/quote and parses signable typed data", async () => {
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: any = null;

    const mockQuoteResponse = {
      quoteId: "quote_test_123",
      targetChain: "base",
      contraChain: "base",
      targetAsset: "0x4200000000000000000000000000000000000006",
      contraAsset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      side: "buy",
      qty: "100",
      orderType: "limit",
      limitNotionalPrice: "2400",
      funderAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      expectedOutputAmount: "0.04166",
      priceImpactPercentage: "0.02",
      fees: {
        estimatedFeeNotional: "0.50",
      },
      evm: {
        orderTypedData: {
          domain: { name: "Flash", version: "1", chainId: 8453 },
          types: { Order: [{ name: "amount", type: "uint256" }] },
          message: { amount: "100000000" },
        },
      },
      validUntil: "2026-11-07T00:00:00.000Z",
    };

    const client = new DefinitiveClient({
      apiKey: "test_flash_key_secret",
      fetch: (async (url: string, init: RequestInit) => {
        capturedUrl = url;
        capturedHeaders = init.headers as Record<string, string>;
        capturedBody = JSON.parse(init.body as string);
        return new Response(JSON.stringify(mockQuoteResponse), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as any,
    });

    const quote = await client.getQuote({
      targetChain: "base",
      contraChain: "base",
      targetAsset: "0x4200000000000000000000000000000000000006",
      contraAsset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      side: "buy",
      qty: "100",
      orderType: "limit",
      limitNotionalPrice: "2400",
      funderAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      flashIntegratorFeeBps: "50",
    });

    assert.equal(capturedUrl, "https://flash.definitive.fi/v1/quote");
    assert.equal(capturedHeaders["x-definitive-api-key"], "test_flash_key_secret");
    assert.equal(capturedBody.orderType, "limit");
    assert.equal(capturedBody.limitNotionalPrice, "2400");
    assert.equal(capturedBody.flashIntegratorFeeBps, "50");

    assert.equal(quote.quoteId, "quote_test_123");
    assert.equal(quote.expectedOutputAmount, "0.04166");
    assert.ok(quote.evm?.orderTypedData);
    assert.equal(typeof quote.evm?.orderTypedData === "object" ? quote.evm.orderTypedData.domain.name : "Flash", "Flash");
  });

  it("submits signed order to /v1/order without blind retries", async () => {
    let callCount = 0;
    const client = new DefinitiveClient({
      apiKey: "test_key",
      fetch: (async () => {
        callCount++;
        return new Response(
          JSON.stringify({
            orderId: "order_flash_789",
            status: "open",
            createdAt: "2026-11-06T23:00:00Z",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }) as any,
    });

    const res = await client.submitOrder({
      targetChain: "base",
      contraChain: "base",
      targetAsset: "0x4200000000000000000000000000000000000006",
      contraAsset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      side: "buy",
      qty: "100",
      orderType: "limit",
      funderAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      quoteId: "quote_test_123",
      userSignature: "0xabcdef1234567890",
    });

    assert.equal(callCount, 1);
    assert.equal(res.orderId, "order_flash_789");
    assert.equal(res.status, "PENDING"); // 'open' maps to 'PENDING'
  });

  it("polls order status from /v1/orders/{orderId} and extracts on-chain transaction hash", async () => {
    const client = new DefinitiveClient({
      apiKey: "test_key",
      fetch: (async (url: string) => {
        assert.ok(url.includes("/orders/order_flash_789"));
        return new Response(
          JSON.stringify({
            orderId: "order_flash_789",
            status: "filled",
            fills: [
              {
                fillId: "fill_1",
                txHash: "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba",
                amount: "0.0416",
                price: "2400",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }) as any,
    });

    const status = await client.getOrderStatus("order_flash_789");
    assert.equal(status.orderId, "order_flash_789");
    assert.equal(status.status, "FILLED");
    assert.equal(
      status.transactionHash,
      "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba",
    );
  });

  it("maps Flash status strings to CallLedger OrderStatus accurately", () => {
    assert.equal(mapFlashStatusToOrderStatus("filled"), "FILLED");
    assert.equal(mapFlashStatusToOrderStatus("partially_filled"), "PARTIALLY_FILLED");
    assert.equal(mapFlashStatusToOrderStatus("open"), "PENDING");
    assert.equal(mapFlashStatusToOrderStatus("submitted"), "SUBMITTED");
    assert.equal(mapFlashStatusToOrderStatus("cancelled"), "CANCELLED");
    assert.equal(mapFlashStatusToOrderStatus("failed"), "FAILED");
  });
});
