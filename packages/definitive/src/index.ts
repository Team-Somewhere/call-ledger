import type {
  OrderProvider,
  OrderStatus,
  OrderType,
} from "@call-ledger/shared";

/**
 * Definitive Flash client configuration.
 * Note: Never store private keys or wallet seeds here.
 */
export interface DefinitiveClientConfig {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

/**
 * Quote request parameters for Definitive Flash execution.
 */
export interface FlashQuoteRequest {
  chainId: number | string;
  walletAddress: string;
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  slippageToleranceBasisPoints?: number;
  orderType?: OrderType;
}

/**
 * Price quote returned by Definitive Flash.
 */
export interface FlashQuoteResponse {
  quoteId: string;
  provider: OrderProvider;
  chainId: number | string;
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  expectedOutputAmount: string;
  minimumOutputAmount: string;
  priceImpactPercentage: string;
  estimatedGasFee: string;
  validUntil: string;
}

/**
 * Typed EIP-712 or Solana transaction data required for user wallet signature.
 */
export interface FlashOrderSigningData {
  quoteId: string;
  orderId: string;
  chainId: number | string;
  verifyingContract: string;
  domain: Record<string, unknown>;
  types: Record<string, unknown>;
  message: Record<string, unknown>;
  rawPayload?: string;
}

/**
 * Submission payload containing user's cryptographic signature.
 */
export interface FlashSignedOrderSubmission {
  quoteId: string;
  walletAddress: string;
  signature: string;
  signedPayload?: string;
}

/**
 * Order status response from Definitive tracking API.
 */
export interface FlashOrderStatusResponse {
  providerOrderId: string;
  status: OrderStatus;
  inputAmount: string;
  executedOutputAmount?: string;
  transactionHash?: string;
  blockTimestamp?: string;
  failureReason?: string;
}

/**
 * Interface contract for Definitive Flash API client.
 */
export interface IDefinitiveClient {
  isConfigured(): boolean;
  getQuote(request: FlashQuoteRequest): Promise<FlashQuoteResponse>;
  buildSigningData(
    quoteId: string,
    walletAddress: string,
  ): Promise<FlashOrderSigningData>;
  submitSignedOrder(
    submission: FlashSignedOrderSubmission,
  ): Promise<{ providerOrderId: string; status: OrderStatus }>;
  getOrderStatus(providerOrderId: string): Promise<FlashOrderStatusResponse>;
}

/**
 * Factory placeholder to construct a Definitive Flash client.
 * Does not make live trading requests or network calls in Phase 1.
 */
export function createDefinitiveClient(
  config: DefinitiveClientConfig = {},
): IDefinitiveClient {
  const isReady = Boolean(config.apiKey);

  return {
    isConfigured(): boolean {
      return isReady;
    },
    async getQuote(_request: FlashQuoteRequest): Promise<FlashQuoteResponse> {
      throw new Error(
        "Definitive Flash trading client is reserved for Phase 5. Live quotes require an active DEFINITIVE_API_KEY.",
      );
    },
    async buildSigningData(
      _quoteId: string,
      _walletAddress: string,
    ): Promise<FlashOrderSigningData> {
      throw new Error("Signing data generation is reserved for Phase 5.");
    },
    async submitSignedOrder(
      _submission: FlashSignedOrderSubmission,
    ): Promise<{ providerOrderId: string; status: OrderStatus }> {
      throw new Error("Signed order execution is reserved for Phase 5.");
    },
    async getOrderStatus(
      _providerOrderId: string,
    ): Promise<FlashOrderStatusResponse> {
      throw new Error("Order status tracking is reserved for Phase 5.");
    },
  };
}
