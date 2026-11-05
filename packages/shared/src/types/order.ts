import type {
  OrderProvider,
  OrderStatus,
  OrderType,
} from "../constants/statuses";

export interface Order {
  id: string;
  userId: string;
  signalId: string | null;
  strategyId: string | null;
  provider: OrderProvider;
  providerOrderId: string | null;
  chainId: number | string;
  walletAddress: string;
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  outputAmount: string | null;
  orderType: OrderType;
  status: OrderStatus;
  transactionHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}
