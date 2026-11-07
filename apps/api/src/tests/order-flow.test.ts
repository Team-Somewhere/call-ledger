import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  setDefinitiveClientForTesting,
  requestFlashQuote,
  OrderServiceError,
  isDefinitiveConfigured,
} from "../services/order.service";
import { getOrderConfig, getQuote, submitOrder } from "../controllers/order.controller";
import type {
  FlashOrderStatusResponse,
  FlashQuoteRequest,
  FlashQuoteResponse,
  FlashSubmitOrderRequest,
  FlashSubmitOrderResponse,
  IDefinitiveClient,
} from "@call-ledger/definitive";

describe("Order Service & Controller Unit Tests", () => {
  const testAddress = "0x1111111111111111111111111111111111111111";
  const testUserId = "00000000-0000-0000-0000-000000000001";

  const mockFlashClient: IDefinitiveClient = {
    isConfigured: () => true,
    getQuote: async (req: FlashQuoteRequest): Promise<FlashQuoteResponse> => {
      return {
        quoteId: "mock_quote_abc",
        targetChain: req.targetChain,
        contraChain: req.contraChain,
        targetAsset: req.targetAsset,
        contraAsset: req.contraAsset,
        side: req.side,
        qty: req.qty,
        orderType: req.orderType ?? "limit",
        limitNotionalPrice: req.limitNotionalPrice,
        funderAddress: req.funderAddress,
        expectedOutputAmount: "0.0416",
        evm: {
          orderTypedData: {
            domain: { name: "Flash", version: "1" },
            types: { Order: [] },
            message: {},
          },
        },
        validUntil: new Date(Date.now() + 60000).toISOString(),
      };
    },
    submitOrder: async (req: FlashSubmitOrderRequest): Promise<FlashSubmitOrderResponse> => {
      return {
        orderId: "mock_order_xyz",
        status: "SUBMITTED",
        createdAt: new Date().toISOString(),
      };
    },
    getOrderStatus: async (orderId: string): Promise<FlashOrderStatusResponse> => {
      return {
        orderId,
        status: "FILLED",
        transactionHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      };
    },
    listOrders: async () => ({ orders: [], nextPageToken: null }),
    cancelOrder: async () => ({ ok: true }),
    submitSetupTransaction: async () => ({ status: "confirmed" }),
  };

  before(() => {
    setDefinitiveClientForTesting(mockFlashClient);
  });

  after(() => {
    setDefinitiveClientForTesting(null);
  });

  it("getOrderConfig returns configured: true and verified token lists", async () => {
    let responseData: any = null;
    let statusCode = 200;

    const res: any = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(payload: any) {
        responseData = payload;
        return this;
      },
    };

    await getOrderConfig({} as any, res);
    assert.equal(statusCode, 200);
    assert.equal(responseData.success, true);
    assert.equal(responseData.data.configured, true);
    assert.ok(responseData.data.supportedChains.base);
    assert.ok(responseData.data.verifiedAssets.base.WETH);
  });

  it("requestFlashQuote rejects mismatched funder wallet with UNAUTHORIZED_WALLET", async () => {
    const differentWallet = "0x2222222222222222222222222222222222222222";

    await assert.rejects(
      async () => {
        await requestFlashQuote(testAddress, {
          targetChain: "base",
          contraChain: "base",
          targetAsset: "0x4200000000000000000000000000000000000006",
          contraAsset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          side: "buy",
          qty: "100",
          orderType: "limit",
          funderAddress: differentWallet,
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof OrderServiceError);
        assert.equal(err.code, "UNAUTHORIZED_WALLET");
        assert.equal(err.statusCode, 403);
        return true;
      },
    );
  });

  it("requestFlashQuote succeeds when funder matches authenticated wallet", async () => {
    const quote = await requestFlashQuote(testAddress, {
      targetChain: "base",
      contraChain: "base",
      targetAsset: "0x4200000000000000000000000000000000000006",
      contraAsset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      side: "buy",
      qty: "100",
      orderType: "limit",
      limitNotionalPrice: "2400",
      funderAddress: testAddress,
    });

    assert.equal(quote.quoteId, "mock_quote_abc");
    assert.equal(quote.expectedOutputAmount, "0.0416");
    assert.ok(quote.evm?.orderTypedData);
  });

  it("getQuote controller parses valid payload and responds with 200", async () => {
    let responseData: any = null;
    let statusCode = 200;

    const req: any = {
      auth: { id: testUserId, address: testAddress, isAdmin: false },
      body: {
        targetChain: "base",
        contraChain: "base",
        targetAsset: "0x4200000000000000000000000000000000000006",
        contraAsset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        side: "buy",
        qty: "100",
        orderType: "limit",
        limitNotionalPrice: "2400",
        funderAddress: testAddress,
      },
    };

    const res: any = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(payload: any) {
        responseData = payload;
        return this;
      },
    };

    await getQuote(req, res);
    assert.equal(statusCode, 200);
    assert.equal(responseData.success, true);
    assert.equal(responseData.data.quoteId, "mock_quote_abc");
  });
});
