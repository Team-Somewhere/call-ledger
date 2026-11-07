import type { FlashOrderTypeName, OrderStatus } from "@call-ledger/shared";

/**
 * Definitive Flash client configuration.
 * Security: NEVER store private keys, wallet seeds, or client credentials here.
 */
export interface DefinitiveClientConfig {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

/**
 * Request parameters for Definitive Flash /v1/quote.
 * Follows verified official Definitive Flash OpenAPI schema.
 */
export interface FlashPriceTrigger {
  notionalPrice?: string;
  crossPrice?: string;
  triggerType: "upper" | "lower";
  limitPrice?: string;
}

export interface FlashAttachedBracketLeg {
  notionalPrice?: string;
  crossPrice?: string;
  limitPrice?: string;
}

export interface FlashQuoteRequest {
  targetChain: string;
  contraChain: string;
  targetAsset: string;
  contraAsset: string;
  side: "buy" | "sell";
  qty: string;
  orderType?: FlashOrderTypeName;
  limitNotionalPrice?: string;
  limitCrossPrice?: string;
  funderAddress: string;
  maxSlippage?: string;
  maxPriceImpact?: string;
  expireTime?: string;
  flashIntegratorFeeBps?: string;
  recipientAddress?: string;
  startTime?: string;
  durationSeconds?: number;
  twapBucketCount?: number;
  triggers?: FlashPriceTrigger[];
  attachedBracket?: {
    takeProfit: FlashAttachedBracketLeg;
    stopLoss: FlashAttachedBracketLeg;
    expireTime?: string;
  };
  /** Prefer a sized allowance over an unlimited grant. */
  forceMinimalAllowance?: boolean;
  evmUsePermit2?: boolean;
}

/**
 * Signable EIP-712 typed data returned by Flash for EVM trades.
 */
export interface EvmOrderTypedData {
  domain: Record<string, unknown>;
  types: Record<string, unknown>;
  primaryType?: string;
  message: Record<string, unknown>;
}

/**
 * Live price quote and signing payload returned by Definitive Flash /v1/quote.
 */
export interface FlashQuoteResponse {
  quoteId: string;
  targetChain: string;
  contraChain: string;
  targetAsset: string;
  contraAsset: string;
  side: "buy" | "sell";
  qty: string;
  orderType: string;
  limitNotionalPrice?: string;
  funderAddress: string;
  expectedOutputAmount?: string;
  minimumOutputAmount?: string;
  priceImpactPercentage?: string;
  from?: { asset: string; amount: string; notional: string };
  to?: { asset: string; amount: string; notional: string };
  fees?: {
    estimatedFeeNotional?: string;
    integratorFeeBps?: string;
    protocolFeeNotional?: string;
  };
  estimatedPriceImpact?: string | null;
  recommendedSlippage?: string | null;
  bridgeQuoteId?: string | null;
  setupTxs?: string[] | null;
  evm?: {
    orderTypedData?: EvmOrderTypedData | string;
    /** Exact string to echo on submit when Flash returned a string. */
    orderTypedDataRaw?: string;
    permitTypedData?: string | null;
    approveTx?: {
      to: string;
      data: string;
      value?: string;
    } | null;
  };
  attachedBracket?: Record<string, unknown> | null;
  wrap?: {
    evmTx?: {
      to: string;
      data: string;
      value?: string;
    } | null;
  };
  validUntil?: string;
  rawPayload?: Record<string, unknown>;
}

/**
 * Submission payload with user's cryptographic signature sent to Definitive Flash /v1/order.
 */
export interface FlashSubmitOrderRequest {
  targetChain: string;
  contraChain: string;
  targetAsset: string;
  contraAsset: string;
  side: "buy" | "sell";
  qty: string;
  orderType: FlashOrderTypeName;
  funderAddress: string;
  quoteId: string;
  userSignature: string;
  evmOrderTypedData?: EvmOrderTypedData | Record<string, unknown> | string;
  evmPermitTypedData?: string;
  evmPermitSignature?: string;
  limitNotionalPrice?: string;
  limitCrossPrice?: string;
  maxSlippage?: string;
  maxPriceImpact?: string;
  expireTime?: string;
  flashIntegratorFeeBps?: string;
  recipientAddress?: string;
  bridgeQuoteId?: string;
  startTime?: string;
  twapBucketCount?: number;
  triggers?: FlashPriceTrigger[];
  attachedBracket?: Record<string, unknown>;
}

/**
 * Response after order submission from Definitive Flash /v1/order.
 */
export interface FlashSubmitOrderResponse {
  orderId: string;
  status: OrderStatus;
  createdAt?: string;
  raw?: Record<string, unknown>;
}

/**
 * Execution fill record returned by Definitive Flash order tracking.
 */
export interface FlashOrderFill {
  fillId?: string;
  orderId?: string;
  rootOrderId?: string;
  txHash?: string;
  transactionId?: string;
  amount?: string;
  targetAmount?: string;
  contraAmount?: string;
  price?: string;
  fillPrice?: string;
  notional?: string;
  feeAmount?: string;
  feeNotional?: string;
  integratorFeeNotional?: string;
  timestamp?: string;
  filledAt?: string;
  status?: string;
}

/**
 * Live order status and on-chain tracking details from /v1/orders/{orderId}.
 */
export interface FlashOrderStatusResponse {
  orderId: string;
  status: OrderStatus;
  targetChain?: string;
  targetAsset?: string;
  contraAsset?: string;
  side?: "buy" | "sell";
  qty?: string;
  executedQty?: string;
  transactionHash?: string | null;
  fills?: FlashOrderFill[];
  filled?: {
    targetAmount?: string | null;
    contraAmount?: string | null;
    averagePrice?: string | null;
    averageNotionalPrice?: string | null;
  };
  rawStatus?: string;
  closeReason?: string | null;
  failureReason?: string;
  updatedAt?: string;
  cancellable?: boolean;
}

/**
 * Contract for the Definitive Flash trading client.
 */
export interface FlashCancelResult {
  ok: boolean;
  raw?: Record<string, unknown>;
}

export interface FlashSetupResult {
  status: "confirmed" | "pending" | string;
}

export interface IDefinitiveClient {
  isConfigured(): boolean;
  getQuote(request: FlashQuoteRequest): Promise<FlashQuoteResponse>;
  submitOrder(request: FlashSubmitOrderRequest): Promise<FlashSubmitOrderResponse>;
  getOrderStatus(orderId: string): Promise<FlashOrderStatusResponse>;
  listOrders(params: {
    funderAddress?: string;
    statuses?: string;
    pageSize?: number;
    pageToken?: string;
  }): Promise<{ orders: Array<Record<string, unknown>>; nextPageToken: string | null }>;
  cancelOrder(
    orderId: string,
    body: { cancelMessage: string; userSignature: string },
  ): Promise<FlashCancelResult>;
  submitSetupTransaction(signedSetupTx: string): Promise<FlashSetupResult>;
}

