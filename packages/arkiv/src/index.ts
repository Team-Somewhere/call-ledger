import type { ArkivRecordType } from "@call-ledger/shared";

/**
 * Configuration options for Arkiv client initialization.
 */
export interface ArkivClientConfig {
  rpcUrl?: string;
  privateKey?: string;
  contractAddress?: string;
  network?: "mainnet" | "testnet" | "devnet";
  timeoutMs?: number;
}

/**
 * Metadata schema for an on-chain Arkiv attestation record.
 */
export interface ArkivEntityRecord<T = unknown> {
  id: string;
  recordType: ArkivRecordType;
  entityKey: string;
  ownerAddress: string;
  payloadHash: string;
  data: T;
  blockNumber?: number;
  transactionHash?: string;
  expiresAt?: Date | null;
  createdAt: Date;
}

/**
 * Creator profile attestation payload.
 * Stores non-sensitive public reputation data. Never contains private user data.
 */
export interface ArkivCreatorProfilePayload {
  xUserId: string;
  xUsername: string;
  displayName: string;
  walletAddress: string;
  registeredAt: string;
}

/**
 * Signal attestation payload.
 * Anchors the verified signal timestamp and key parameters immutably.
 */
export interface ArkivSignalAttestationPayload {
  signalId: string;
  creatorXUserId: string;
  assetSymbol: string;
  direction: "BUY" | "SELL";
  capturedTimestamp: string;
  entryPriceSnapshot?: string;
}

/**
 * Performance snapshot attestation payload.
 * Periodic periodic checkpoint of creator performance.
 */
export interface ArkivPerformanceSnapshotPayload {
  creatorId: string;
  winRate: string;
  totalSignals: number;
  verifiedSignals: number;
  cumulativeReturn: string;
  snapshotPeriodStart: string;
  snapshotPeriodEnd: string;
}

/**
 * Query filter parameters for Arkiv records.
 */
export interface ArkivQueryFilter {
  recordType?: ArkivRecordType;
  ownerAddress?: string;
  entityKey?: string;
  limit?: number;
  cursor?: string;
}

/**
 * Abstract client interface for Arkiv interactions.
 * Implementation will be integrated in future phases.
 */
export interface IArkivClient {
  isConfigured(): boolean;
  createEntity<T>(
    recordType: ArkivRecordType,
    entityKey: string,
    payload: T,
  ): Promise<ArkivEntityRecord<T>>;
  getEntity<T>(entityKey: string): Promise<ArkivEntityRecord<T> | null>;
  queryEntities<T>(filter: ArkivQueryFilter): Promise<ArkivEntityRecord<T>[]>;
}

/**
 * Factory placeholder to construct an ArkivClient instance.
 * Does not make live network or blockchain calls in Phase 1.
 */
export function createArkivClient(
  config: ArkivClientConfig = {},
): IArkivClient {
  const isReady = Boolean(config.rpcUrl && config.privateKey);

  return {
    isConfigured(): boolean {
      return isReady;
    },
    async createEntity<T>(
      _recordType: ArkivRecordType,
      _entityKey: string,
      _payload: T,
    ): Promise<ArkivEntityRecord<T>> {
      throw new Error(
        "Arkiv client write operations are reserved for Phase 6. Real transactions will be executed once Arkiv contracts are deployed.",
      );
    },
    async getEntity<T>(
      _entityKey: string,
    ): Promise<ArkivEntityRecord<T> | null> {
      return null;
    },
    async queryEntities<T>(
      _filter: ArkivQueryFilter,
    ): Promise<ArkivEntityRecord<T>[]> {
      return [];
    },
  };
}
