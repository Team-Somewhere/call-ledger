export interface Wallet {
  id: string;
  userId: string;
  address: string;
  chainId: number | string;
  walletType: string;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateWalletInput = {
  userId: string;
  address: string;
  chainId: number | string;
  walletType: string;
  isPrimary?: boolean;
};
