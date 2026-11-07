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

const CANCELLABLE = new Set([
  "ORDER_STATUS_PENDING",
  "ORDER_STATUS_ACCEPTED",
  "ORDER_STATUS_PARTIALLY_FILLED",
  "pending",
  "accepted",
  "partially_filled",
  "open",
]);

export function flashCancelMessage(orderId: string): string {
  return `Definitive Flash v1 — Cancel Order\nOrder: ${orderId}`;
}

export function mapFlashStatusToOrderStatus(rawStatus?: string): OrderStatus {
  if (!rawStatus) return "PENDING";
  const s = rawStatus.trim();
  const lower = s.toLowerCase();
  switch (s) {
    case "ORDER_STATUS_FILLED":
      return "FILLED";
    case "ORDER_STATUS_PARTIALLY_FILLED":
      return "PARTIALLY_FILLED";
    case "ORDER_STATUS_PENDING":
    case "ORDER_STATUS_ACCEPTED":
    case "ORDER_STATUS_UNSPECIFIED":
      return "PENDING";
    case "ORDER_STATUS_CANCELLED":
      return "CANCELLED";
    case "ORDER_STATUS_REJECTED":
    case "ORDER_STATUS_TERMINATED":
      return "FAILED";
    default:
      break;
  }
  switch (lower) {
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
    case "accepted":
    case "routing":
      return "PENDING";
    case "cancelled":
    case "canceled":
      return "CANCELLED";
    case "pending_cancel":
    case "pending_cancellation":
      return "PENDING_CANCELLATION";
    case "expired":
      return "EXPIRED";
    case "failed":
    case "rejected":
      return "FAILED";
    default:
      return "PENDING";
  }
}

export function isFlashStatusCancellable(rawStatus?: string): boolean {
  if (!rawStatus) return false;
  return CANCELLABLE.has(rawStatus) || CANCELLABLE.has(rawStatus.toLowerCase());
}

function flashErrorMessage(data: Record<string, any>, status: number): string {
  const base =
    typeof data?.message === "string"
      ? data.message
      : typeof data?.error === "string"
        ? data.error
        : typeof data?.error?.message === "string"
          ? data.error.message
          : `Flash quote failed with HTTP ${status}`;
  const details = data?.error?.details ?? data?.details;
  if (!details || typeof details !== "object") return base;
  const parts = Object.entries(details as Record<string, unknown>).map(([key, value]) => {
    const text = Array.isArray(value) ? value.map(String).join(", ") : String(value);
    return `${key}: ${text}`;
  });
  return parts.length > 0 ? `${base}: ${parts.join("; ")}` : base;
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
    if (request.maxPriceImpact) bodyPayload.maxPriceImpact = request.maxPriceImpact;
    if (request.startTime) bodyPayload.startTime = request.startTime;
    if (request.durationSeconds != null) bodyPayload.durationSeconds = request.durationSeconds;
    if (request.twapBucketCount != null) bodyPayload.twapBucketCount = request.twapBucketCount;
    if (request.triggers) bodyPayload.triggers = request.triggers;
    if (request.attachedBracket) bodyPayload.attachedBracket = request.attachedBracket;
    if (request.forceMinimalAllowance != null) {
      bodyPayload.forceMinimalAllowance = request.forceMinimalAllowance;
    }
    if (request.evmUsePermit2 != null) bodyPayload.evmUsePermit2 = request.evmUsePermit2;

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
      const errMsg = flashErrorMessage(data, res.status);
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
    const orderTypedDataRaw =
      typeof rawOrderTypedData === "string" ? rawOrderTypedData : undefined;
    const toLeg = data.to as { amount?: string } | undefined;
    const fromLeg = data.from as { asset?: string; amount?: string; notional?: string } | undefined;

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
      orderTypedDataRaw,
      permitTypedData:
        typeof evmRaw.permitTypedData === "string" ? evmRaw.permitTypedData : null,
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
      from: fromLeg?.amount
        ? {
            asset: String(fromLeg.asset ?? ""),
            amount: String(fromLeg.amount),
            notional: String((fromLeg as { notional?: string }).notional ?? ""),
          }
        : undefined,
      to: toLeg?.amount
        ? {
            asset: String((data.to as { asset?: string }).asset ?? ""),
            amount: String(toLeg.amount),
            notional: String((data.to as { notional?: string }).notional ?? ""),
          }
        : undefined,
      expectedOutputAmount:
        data.expectedOutputAmount != null
          ? String(data.expectedOutputAmount)
          : toLeg?.amount != null
            ? String(toLeg.amount)
            : undefined,
      minimumOutputAmount: data.minimumOutputAmount != null ? String(data.minimumOutputAmount) : undefined,
      priceImpactPercentage:
        data.priceImpactPercentage != null
          ? String(data.priceImpactPercentage)
          : data.estimatedPriceImpact != null
            ? String(data.estimatedPriceImpact)
            : undefined,
      estimatedPriceImpact:
        data.estimatedPriceImpact != null ? String(data.estimatedPriceImpact) : null,
      recommendedSlippage:
        data.recommendedSlippage != null ? String(data.recommendedSlippage) : null,
      fees: data.fees,
      bridgeQuoteId: data.bridgeQuoteId ?? null,
      setupTxs: Array.isArray(data.setupTxs) ? data.setupTxs.map(String) : null,
      evm: normalizedEvm,
      wrap: normalizedWrap,
      attachedBracket: (data.attachedBracket as Record<string, unknown> | null) ?? null,
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
      bodyPayload.evmOrderTypedData =
        typeof request.evmOrderTypedData === "string"
          ? request.evmOrderTypedData
          : JSON.stringify(request.evmOrderTypedData);
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
    if (request.evmPermitTypedData) bodyPayload.evmPermitTypedData = request.evmPermitTypedData;
    if (request.evmPermitSignature) bodyPayload.evmPermitSignature = request.evmPermitSignature;
    if (request.limitCrossPrice) bodyPayload.limitCrossPrice = request.limitCrossPrice;
    if (request.maxSlippage) bodyPayload.maxSlippage = request.maxSlippage;
    if (request.maxPriceImpact) bodyPayload.maxPriceImpact = request.maxPriceImpact;
    if (request.recipientAddress) bodyPayload.recipientAddress = request.recipientAddress;
    if (request.bridgeQuoteId) bodyPayload.bridgeQuoteId = request.bridgeQuoteId;
    if (request.startTime) bodyPayload.startTime = request.startTime;
    if (request.twapBucketCount != null) bodyPayload.twapBucketCount = request.twapBucketCount;
    if (request.triggers) bodyPayload.triggers = request.triggers;
    if (request.attachedBracket) bodyPayload.attachedBracket = request.attachedBracket;

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

        const order =
          data.order && typeof data.order === "object" ? (data.order as Record<string, any>) : data;
        const fills = Array.isArray(data.fills)
          ? data.fills
          : Array.isArray(order.fills)
            ? order.fills
            : [];
        const transactionHash =
          order.transactionHash ||
          order.txHash ||
          fills.find((f: any) => f.transactionId || f.txHash)?.transactionId ||
          fills.find((f: any) => f.txHash)?.txHash ||
          null;
        const rawStatus = String(order.status ?? data.status ?? "");
        const filled = (order.filled ?? null) as Record<string, string | null> | null;

        return {
          orderId: String(order.orderId || order.id || data.orderId || orderId),
          status: mapFlashStatusToOrderStatus(rawStatus),
          rawStatus,
          targetChain: order.targetChain,
          targetAsset: order.targetAsset,
          contraAsset: order.contraAsset,
          side: order.side,
          qty: order.qty != null ? String(order.qty) : undefined,
          executedQty:
            filled?.targetAmount != null
              ? String(filled.targetAmount)
              : order.executedQty != null
                ? String(order.executedQty)
                : undefined,
          transactionHash,
          fills,
          filled: filled
            ? {
                targetAmount: filled.targetAmount,
                contraAmount: filled.contraAmount,
                averagePrice: filled.averagePrice,
                averageNotionalPrice: filled.averageNotionalPrice,
              }
            : undefined,
          closeReason: order.closeReason ?? null,
          failureReason: order.failureReason || order.closeReason || data.rejectReason,
          updatedAt: order.updatedAt || order.closedAt,
          cancellable: isFlashStatusCancellable(rawStatus),
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

  async listOrders(params: {
    funderAddress?: string;
    statuses?: string;
    pageSize?: number;
    pageToken?: string;
  }): Promise<{ orders: Array<Record<string, unknown>>; nextPageToken: string | null }> {
    this.assertConfigured();
    const query = new URLSearchParams();
    if (params.funderAddress) query.set("funderAddress", params.funderAddress);
    if (params.statuses) query.set("statuses", params.statuses);
    if (params.pageSize) query.set("pageSize", String(params.pageSize));
    if (params.pageToken) query.set("pageToken", params.pageToken);
    const url = `${this.baseUrl}/orders?${query.toString()}`;
    const data = await this.readJson(url);
    return {
      orders: Array.isArray(data.orders) ? data.orders : [],
      nextPageToken: typeof data.nextPageToken === "string" ? data.nextPageToken : null,
    };
  }

  async cancelOrder(
    orderId: string,
    body: { cancelMessage: string; userSignature: string },
  ): Promise<{ ok: boolean; raw?: Record<string, unknown> }> {
    this.assertConfigured();
    const url = `${this.baseUrl}/orders/${encodeURIComponent(orderId)}/cancel`;
    const data = await this.sendJson(url, body, "CANCEL_REJECTED");
    return { ok: data.ok === true, raw: data };
  }

  async submitSetupTransaction(signedSetupTx: string): Promise<{ status: string }> {
    this.assertConfigured();
    const data = await this.sendJson(
      `${this.baseUrl}/setup-transaction`,
      { signedSetupTx },
      "SETUP_REJECTED",
    );
    return { status: String(data.status ?? "pending") };
  }

  private async readJson(url: string): Promise<Record<string, any>> {
    const res = await this.fetchWithTimeout(url, {
      method: "GET",
      headers: {
        "content-type": "application/json",
        "x-definitive-api-key": this.apiKey!,
      },
    });
    return this.parseResponse(res, "ORDER_NOT_FOUND");
  }

  private async sendJson(
    url: string,
    body: unknown,
    errorCode: string,
  ): Promise<Record<string, any>> {
    const res = await this.fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-definitive-api-key": this.apiKey!,
      },
      body: JSON.stringify(body),
    });
    return this.parseResponse(res, errorCode);
  }

  private async parseResponse(res: Response, errorCode: string): Promise<Record<string, any>> {
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
        typeof data?.error?.message === "string"
          ? data.error.message
          : typeof data?.message === "string"
            ? data.message
            : `Flash request failed with HTTP ${res.status}`;
      const code = res.status === 429 ? "RATE_LIMITED" : errorCode;
      throw new DefinitiveApiError(code, errMsg, res.status, data?.error ?? data);
    }
    return data;
  }
}

export function createDefinitiveClient(
  config: DefinitiveClientConfig = {},
): IDefinitiveClient {
  return new DefinitiveClient(config);
}

