import type { OrderStatus } from "@call-ledger/shared";
import { DefinitiveApiError } from "./errors";
import type {
  DefinitiveClientConfig,
  FlashOrderStatusResponse,
  FlashQuoteRequest,
  FlashQuoteResponse,
  FlashSubmitOrderRequest,
  FlashSubmitOrderResponse,
  IDefinitiveClient,
} from "./types";

export const DEFAULT_DEFINITIVE_BASE_URL = "https://flash.definitive.fi/v1";
export const DEFAULT_TIMEOUT_MS = 10_000;

export function mapFlashStatusToOrderStatus(rawStatus?: string): OrderStatus {
  if (!rawStatus) return "PENDING";
  const s = rawStatus.toLowerCase().trim();
  switch (s) {
    case "filled":
    case "executed":
    case "completed":
      return "FILLED";
    case "partially_filled":
    case "partial":
      return "PARTIALLY_FILLED";
    case "submitted":
      return "SUBMITTED";
    case "open":
    case "new":
    case "pending":
    case "routing":
      return "PENDING";
    case "cancelled":
    case "canceled":
      return "CANCELLED";
    case "failed":
    case "rejected":
    case "expired":
      return "FAILED";
    default:
      return "PENDING";
  }
}

export class DefinitiveClient implements IDefinitiveClient {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(config: DefinitiveClientConfig = {}) {
    this.apiKey = config.apiKey?.trim();
    this.baseUrl = (config.baseUrl || DEFAULT_DEFINITIVE_BASE_URL).replace(/\/$/, "");
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchFn = config.fetch ?? fetch;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 0);
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new DefinitiveApiError(
        "DEFINITIVE_NOT_CONFIGURED",
        "Definitive Flash API key is not configured. Add DEFINITIVE_API_KEY to your server environment.",
        503,
      );
    }
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchFn(url, {
        ...options,
        signal: controller.signal,
      });
      return res;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new DefinitiveApiError(
          "TIMEOUT",
          `Definitive Flash request timed out after ${this.timeoutMs}ms`,
          504,
        );
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Request a real-time price quote and signable typed data from /v1/quote.
   */
  async getQuote(request: FlashQuoteRequest): Promise<FlashQuoteResponse> {
    this.assertConfigured();

    const url = `${this.baseUrl}/quote`;
    const bodyPayload: Record<string, unknown> = {
      targetChain: request.targetChain,
      contraChain: request.contraChain,
      targetAsset: request.targetAsset,
      contraAsset: request.contraAsset,
      side: request.side,
      qty: request.qty,
      orderType: request.orderType ?? "limit",
      funderAddress: request.funderAddress,
    };

    if (request.limitNotionalPrice) {
      bodyPayload.limitNotionalPrice = request.limitNotionalPrice;
    }
    if (request.limitCrossPrice) {
      bodyPayload.limitCrossPrice = request.limitCrossPrice;
    }
    if (request.maxSlippage) {
      bodyPayload.maxSlippage = request.maxSlippage;
    }
    if (request.expireTime) {
      bodyPayload.expireTime = request.expireTime;
    }
    if (request.flashIntegratorFeeBps) {
      bodyPayload.flashIntegratorFeeBps = request.flashIntegratorFeeBps;
    }
    if (request.recipientAddress) {
      bodyPayload.recipientAddress = request.recipientAddress;
    }

    let res: Response;
    try {
      res = await this.fetchWithTimeout(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-definitive-api-key": this.apiKey!,
        },
        body: JSON.stringify(bodyPayload),
      });
    } catch (err) {
      if (err instanceof DefinitiveApiError) throw err;
      throw new DefinitiveApiError(
        "NETWORK_ERROR",
        `Failed to reach Definitive Flash quote service: ${err instanceof Error ? err.message : String(err)}`,
        502,
      );
    }

    let data: Record<string, any>;
    try {
      data = (await res.json()) as Record<string, any>;
    } catch {
      throw new DefinitiveApiError(
        "INVALID_RESPONSE",
        `Definitive Flash returned non-JSON response with HTTP ${res.status}`,
        res.status,
      );
    }

    if (!res.ok) {
      const errMsg =
        typeof data?.message === "string"
          ? data.message
          : typeof data?.error === "string"
            ? data.error
            : typeof data?.error?.message === "string"
              ? data.error.message
              : typeof data?.error?.details === "object"
                ? JSON.stringify(data.error.details)
                : typeof data?.error === "object"
                  ? JSON.stringify(data.error)
                  : `Flash quote failed with HTTP ${res.status}`;
      throw new DefinitiveApiError("QUOTE_REJECTED", errMsg, res.status, data);
    }

    const quoteId = data.quoteId || data.id;
    if (!quoteId) {
      throw new DefinitiveApiError(
        "INVALID_RESPONSE",
        "Flash quote response missing quoteId",
        500,
        data,
      );
    }

    const evmRaw = (data.evm || {}) as Record<string, any>;
    const rawApprove =
      evmRaw.approveTx ||
      evmRaw.approve_tx ||
      data.approveTx ||
      data.approve_tx ||
      null;

    const rawOrderTypedData =
      evmRaw.orderTypedData ||
      evmRaw.order_typed_data ||
      data.orderTypedData ||
      data.order_typed_data ||
      undefined;

    const wrapRaw = (data.wrap || {}) as Record<string, any>;
    const rawWrap =
      wrapRaw.evmTx ||
      wrapRaw.evm_tx ||
      data.wrapTx ||
      data.wrap_tx ||
      null;

    const normalizedEvm = {
      ...evmRaw,
      approveTx: rawApprove
        ? {
            to: String(rawApprove.to),
            data: String(rawApprove.data),
            value: rawApprove.value != null ? String(rawApprove.value) : "0",
          }
        : null,
      orderTypedData: rawOrderTypedData,
    };

    const normalizedWrap = rawWrap
      ? {
          evmTx: {
            to: String(rawWrap.to),
            data: String(rawWrap.data),
            value: rawWrap.value != null ? String(rawWrap.value) : "0",
          },
        }
      : undefined;

    return {
      quoteId: String(quoteId),
      targetChain: data.targetChain || request.targetChain,
      contraChain: data.contraChain || request.contraChain,
      targetAsset: data.targetAsset || request.targetAsset,
      contraAsset: data.contraAsset || request.contraAsset,
      side: data.side || request.side,
      qty: String(data.qty || request.qty),
      orderType: data.orderType || request.orderType || "limit",
      limitNotionalPrice: data.limitNotionalPrice || request.limitNotionalPrice,
      funderAddress: data.funderAddress || request.funderAddress,
      expectedOutputAmount: data.expectedOutputAmount != null ? String(data.expectedOutputAmount) : undefined,
      minimumOutputAmount: data.minimumOutputAmount != null ? String(data.minimumOutputAmount) : undefined,
      priceImpactPercentage: data.priceImpactPercentage != null ? String(data.priceImpactPercentage) : undefined,
      fees: data.fees,
      evm: normalizedEvm,
      wrap: normalizedWrap,
      validUntil: data.validUntil || data.expiresAt,
      rawPayload: data,
    };
  }

  /**
   * Submit a signed trade order to /v1/order.
   * NOTE: This is a state-changing transaction. It is NEVER automatically retried.
   */
  async submitOrder(
    request: FlashSubmitOrderRequest,
  ): Promise<FlashSubmitOrderResponse> {
    this.assertConfigured();

    const url = `${this.baseUrl}/order`;
    const bodyPayload: Record<string, unknown> = {
      targetChain: request.targetChain,
      contraChain: request.contraChain,
      targetAsset: request.targetAsset,
      contraAsset: request.contraAsset,
      side: request.side,
      qty: request.qty,
      orderType: request.orderType,
      funderAddress: request.funderAddress,
      quoteId: request.quoteId,
      userSignature: request.userSignature,
    };

    if (request.evmOrderTypedData) {
      bodyPayload.evmOrderTypedData = request.evmOrderTypedData;
    }
    if (request.limitNotionalPrice) {
      bodyPayload.limitNotionalPrice = request.limitNotionalPrice;
    }
    if (request.expireTime) {
      bodyPayload.expireTime = request.expireTime;
    }
    if (request.flashIntegratorFeeBps) {
      bodyPayload.flashIntegratorFeeBps = request.flashIntegratorFeeBps;
    }

    let res: Response;
    try {
      res = await this.fetchWithTimeout(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-definitive-api-key": this.apiKey!,
        },
        body: JSON.stringify(bodyPayload),
      });
    } catch (err) {
      if (err instanceof DefinitiveApiError) throw err;
      throw new DefinitiveApiError(
        "NETWORK_ERROR",
        `Failed to reach Definitive Flash order endpoint: ${err instanceof Error ? err.message : String(err)}`,
        502,
      );
    }

    let data: Record<string, any>;
    try {
      data = (await res.json()) as Record<string, any>;
    } catch {
      throw new DefinitiveApiError(
        "INVALID_RESPONSE",
        `Definitive Flash returned non-JSON response with HTTP ${res.status}`,
        res.status,
      );
    }

    if (!res.ok) {
      const errMsg =
        typeof data?.message === "string"
          ? data.message
          : typeof data?.error === "string"
            ? data.error
            : typeof data?.error?.message === "string"
              ? data.error.message
              : typeof data?.error?.details === "object"
                ? JSON.stringify(data.error.details)
                : typeof data?.error === "object"
                  ? JSON.stringify(data.error)
                  : `Flash order submission failed with HTTP ${res.status}`;
      throw new DefinitiveApiError("SUBMISSION_REJECTED", errMsg, res.status, data);
    }

    const orderId = data.orderId || data.id;
    if (!orderId) {
      throw new DefinitiveApiError(
        "INVALID_RESPONSE",
        "Flash order response missing orderId",
        500,
        data,
      );
    }

    return {
      orderId: String(orderId),
      status: mapFlashStatusToOrderStatus(data.status ?? "submitted"),
      createdAt: data.createdAt,
      raw: data,
    };
  }

  /**
   * Query the live status of an order via GET /v1/orders/{orderId}.
   * Idempotent read: safe to retry with exponential backoff on transient network faults.
   */
  async getOrderStatus(orderId: string): Promise<FlashOrderStatusResponse> {
    this.assertConfigured();

    const cleanOrderId = encodeURIComponent(orderId);
    const url = `${this.baseUrl}/orders/${cleanOrderId}`;

    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await this.fetchWithTimeout(url, {
          method: "GET",
          headers: {
            "content-type": "application/json",
            "x-definitive-api-key": this.apiKey!,
          },
        });

        let data: Record<string, any>;
        try {
          data = (await res.json()) as Record<string, any>;
        } catch {
          throw new DefinitiveApiError(
            "INVALID_RESPONSE",
            `Flash status returned non-JSON response with HTTP ${res.status}`,
            res.status,
          );
        }

        if (!res.ok) {
          const errMsg =
            data?.message || data?.error || `Flash status lookup failed with HTTP ${res.status}`;
          throw new DefinitiveApiError("ORDER_NOT_FOUND", errMsg, res.status, data);
        }

        const fills = Array.isArray(data.fills) ? data.fills : [];
        const transactionHash =
          data.transactionHash ||
          data.txHash ||
          fills.find((f: any) => f.txHash)?.txHash ||
          null;

        return {
          orderId: String(data.orderId || data.id || orderId),
          status: mapFlashStatusToOrderStatus(data.status),
          targetChain: data.targetChain,
          targetAsset: data.targetAsset,
          contraAsset: data.contraAsset,
          side: data.side,
          qty: data.qty != null ? String(data.qty) : undefined,
          executedQty: data.executedQty != null ? String(data.executedQty) : undefined,
          transactionHash,
          fills,
          failureReason: data.failureReason || data.rejectReason,
          updatedAt: data.updatedAt,
        };
      } catch (err) {
        lastError = err;
        if (err instanceof DefinitiveApiError && err.statusCode < 500) {
          // Client errors (404, 400) should not be retried
          throw err;
        }
        if (attempt === 1) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    }

    if (lastError instanceof DefinitiveApiError) throw lastError;
    throw new DefinitiveApiError(
      "NETWORK_ERROR",
      `Failed to retrieve order status from Flash after 2 attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
      502,
    );
  }
}

export function createDefinitiveClient(
  config: DefinitiveClientConfig = {},
): IDefinitiveClient {
  return new DefinitiveClient(config);
}

