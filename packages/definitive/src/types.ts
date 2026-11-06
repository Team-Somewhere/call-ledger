import type { OrderStatus } from "@call-ledger/shared";

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
export interface FlashQuoteRequest {
  targetChain: string;
  contraChain: string;
  targetAsset: string;
  contraAsset: string;
  side: "buy" | "sell";
  qty: string;
  orderType?: "limit" | "market";
  limitNotionalPrice?: string;
  limitCrossPrice?: string;
  funderAddress: string;
  maxSlippage?: string;
  expireTime?: string;
  flashIntegratorFeeBps?: string;
  recipientAddress?: string;
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
  fees?: {
    estimatedFeeNotional?: string;
    integratorFeeBps?: string;
    protocolFeeNotional?: string;
  };
  evm?: {
    orderTypedData?: EvmOrderTypedData | string;
    approveTx?: {
      to: string;
      data: string;
      value?: string;
    } | null;
  };
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
  orderType: "limit" | "market";
  funderAddress: string;
  quoteId: string;
  userSignature: string;
  evmOrderTypedData?: EvmOrderTypedData | Record<string, unknown> | string;
  limitNotionalPrice?: string;
  expireTime?: string;
  flashIntegratorFeeBps?: string;
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
  txHash?: string;
  amount?: string;
  price?: string;
  timestamp?: string;
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
  failureReason?: string;
  updatedAt?: string;
}

/**
 * Contract for the Definitive Flash trading client.
 */
export interface IDefinitiveClient {
  isConfigured(): boolean;
  getQuote(request: FlashQuoteRequest): Promise<FlashQuoteResponse>;
  submitOrder(request: FlashSubmitOrderRequest): Promise<FlashSubmitOrderResponse>;
  getOrderStatus(orderId: string): Promise<FlashOrderStatusResponse>;
}

